// Mock all external dependencies
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
}));

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock('path', () => ({
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn((p) => {
    const parts = p.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
  }),
}));

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-elastic-beanstalk', () => ({
  ElasticBeanstalkClient: jest.fn(() => ({ send: mockSend })),
  CreateApplicationVersionCommand: jest.fn(),
  UpdateEnvironmentCommand: jest.fn(),
  CreateEnvironmentCommand: jest.fn(),
  DescribeEnvironmentsCommand: jest.fn(),
  DescribeApplicationVersionsCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(() => ({ send: mockSend })),
  GetCallerIdentityCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-iam', () => ({
  IAMClient: jest.fn(() => ({ send: mockSend })),
  GetInstanceProfileCommand: jest.fn(),
  GetRoleCommand: jest.fn(),
}));

import * as fs from 'fs';
import { uploadToS3, createS3Bucket } from '../aws-operations';
import { AWSClients } from '../aws-clients';

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('S3 Operations', () => {
  let mockClients: AWSClients;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClients = AWSClients.getInstance('us-east-1');
  });

  describe('uploadToS3', () => {
    it('should upload file to S3 with version label in key', async () => {
      mockedFs.statSync.mockReturnValue({ size: 1024 } as any);
      mockedFs.readFileSync.mockReturnValue(Buffer.from('content'));
      mockSend.mockResolvedValue({});

      const result = await uploadToS3(mockClients, 'us-east-1', '123456789012', 'my-app', 'v1.0.0', 'app.zip', 3, 1, false);

      expect(result).toEqual({
        bucket: 'elasticbeanstalk-us-east-1-123456789012',
        key: 'my-app/v1.0.0.zip',
      });
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle different file extensions', async () => {
      mockedFs.statSync.mockReturnValue({ size: 2048 } as any);
      mockedFs.readFileSync.mockReturnValue(Buffer.from('content'));
      mockSend.mockResolvedValue({});

      const result = await uploadToS3(mockClients, 'us-west-2', '987654321098', 'app', 'abc123', 'deploy.jar', 3, 1, false);

      expect(result).toEqual({
        bucket: 'elasticbeanstalk-us-west-2-987654321098',
        key: 'app/abc123.jar',
      });
    });

    it('should use correct bucket naming format', async () => {
      mockedFs.statSync.mockReturnValue({ size: 512 } as any);
      mockedFs.readFileSync.mockReturnValue(Buffer.from('test'));
      mockSend.mockResolvedValue({});

      const result = await uploadToS3(mockClients, 'eu-west-1', '111222333444', 'test-app', 'v2.0.0', 'package.zip', 3, 1, false);

      expect(result.bucket).toBe('elasticbeanstalk-eu-west-1-111222333444');
    });
  });

  describe('createS3Bucket', () => {
    it('should not create bucket if it already exists', async () => {
      mockSend.mockResolvedValue({});

      await createS3Bucket(mockClients, 'us-east-1', 'existing-bucket', 3, 1);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should create bucket if it does not exist', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('NoSuchBucket'))
        .mockResolvedValue({});

      await createS3Bucket(mockClients, 'us-east-1', 'new-bucket', 3, 1);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should create bucket with location constraint for non-us-east-1 regions', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('NoSuchBucket'))
        .mockResolvedValue({});

      await createS3Bucket(mockClients, 'eu-central-1', 'euro-bucket', 3, 1);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should handle retry logic on failure', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('NoSuchBucket'))
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockResolvedValue({});

      await createS3Bucket(mockClients, 'us-west-2', 'retry-bucket', 3, 1);

      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should bubble up AccessDenied permissions error', async () => {
      const accessDeniedError = new Error('Access Denied');
      accessDeniedError.name = 'AccessDenied';
      
      mockSend
        .mockRejectedValueOnce(new Error('NoSuchBucket')) // HeadBucket fails (bucket doesn't exist)
        .mockRejectedValueOnce(accessDeniedError) // CreateBucket attempt 1 fails with permissions
        .mockRejectedValueOnce(accessDeniedError) // CreateBucket attempt 2 fails with permissions
        .mockRejectedValueOnce(accessDeniedError); // CreateBucket attempt 3 fails with permissions

      await expect(createS3Bucket(mockClients, 'us-east-1', 'permission-denied-bucket', 3, 1))
        .rejects.toThrow('Create S3 bucket failed after 3 attempts: Access Denied');

      expect(mockSend).toHaveBeenCalledTimes(4); // 1 HeadBucket + 3 CreateBucket attempts
    });

    it('should bubble up BucketAlreadyExists error', async () => {
      const bucketExistsError = new Error('The requested bucket name is not available');
      bucketExistsError.name = 'BucketAlreadyExists';
      
      mockSend
        .mockRejectedValueOnce(new Error('NoSuchBucket')) // HeadBucket fails
        .mockRejectedValueOnce(bucketExistsError) // CreateBucket attempt 1 fails - bucket taken
        .mockRejectedValueOnce(bucketExistsError); // CreateBucket attempt 2 fails - bucket taken

      await expect(createS3Bucket(mockClients, 'eu-west-1', 'taken-bucket-name', 2, 1))
        .rejects.toThrow('Create S3 bucket failed after 2 attempts: The requested bucket name is not available');

      expect(mockSend).toHaveBeenCalledTimes(3); // 1 HeadBucket + 2 CreateBucket attempts
    });

    it('should bubble up InvalidBucketName error', async () => {
      const invalidNameError = new Error('The specified bucket is not valid');
      invalidNameError.name = 'InvalidBucketName';
      
      mockSend
        .mockRejectedValueOnce(new Error('NoSuchBucket')) // HeadBucket fails
        .mockRejectedValueOnce(invalidNameError); // CreateBucket fails - invalid name

      await expect(createS3Bucket(mockClients, 'us-west-2', 'Invalid_Bucket_Name', 1, 1))
        .rejects.toThrow('Create S3 bucket failed after 1 attempts: The specified bucket is not valid');

      expect(mockSend).toHaveBeenCalledTimes(2); // 1 HeadBucket + 1 CreateBucket attempt
    });
  });

  describe('uploadToS3 permissions errors', () => {
    it('should bubble up S3 upload permissions error', async () => {
      const uploadError = new Error('Access Denied');
      uploadError.name = 'AccessDenied';
      
      mockedFs.statSync.mockReturnValue({ size: 1024 } as any);
      mockedFs.readFileSync.mockReturnValue(Buffer.from('content'));
      mockSend
        .mockRejectedValueOnce(uploadError) // PutObject attempt 1 fails
        .mockRejectedValueOnce(uploadError); // PutObject attempt 2 fails

      await expect(uploadToS3(mockClients, 'us-east-1', '123456789012', 'my-app', 'v1.0.0', 'app.zip', 2, 1, false))
        .rejects.toThrow('Upload to S3 failed after 2 attempts: Access Denied');

      expect(mockSend).toHaveBeenCalledTimes(2); // 2 PutObject attempts
    });

    it('should bubble up S3 NoSuchBucket error during upload', async () => {
      const noSuchBucketError = new Error('The specified bucket does not exist');
      noSuchBucketError.name = 'NoSuchBucket';
      
      mockedFs.statSync.mockReturnValue({ size: 2048 } as any);
      mockedFs.readFileSync.mockReturnValue(Buffer.from('test-content'));
      mockSend
        .mockRejectedValueOnce(noSuchBucketError) // PutObject attempt 1 fails
        .mockRejectedValueOnce(noSuchBucketError) // PutObject attempt 2 fails
        .mockRejectedValueOnce(noSuchBucketError); // PutObject attempt 3 fails

      await expect(uploadToS3(mockClients, 'eu-central-1', '987654321098', 'test-app', 'v2.0.0', 'deploy.jar', 3, 1, false))
        .rejects.toThrow('Upload to S3 failed after 3 attempts: The specified bucket does not exist');

      expect(mockSend).toHaveBeenCalledTimes(3); // 3 PutObject attempts
    });
  });
});
