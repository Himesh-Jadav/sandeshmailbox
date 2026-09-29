import mongoose from 'mongoose';
import { Readable } from 'stream';

let bucket = null;
let avatarBucket = null;

export function getGridFSBucket() {
  if (!bucket) {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB is not connected yet');
    }
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'mail_attachments',
    });
  }
  return bucket;
}

export function getAvatarGridFSBucket() {
  if (!avatarBucket) {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB is not connected yet');
    }
    avatarBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'user_avatars',
    });
  }
  return avatarBucket;
}

/**
 * Uploads an avatar image directly to MongoDB GridFS bucket 'user_avatars'
 * @param {string} filename
 * @param {Buffer|Readable} bufferOrStream
 * @param {string} contentType
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
export async function uploadAvatarToGridFS(filename, bufferOrStream, contentType = 'image/jpeg') {
  const gridFSBucket = getAvatarGridFSBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType,
      metadata: { uploadedAt: new Date(), type: 'avatar' },
    });

    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', () => resolve(uploadStream.id));

    if (Buffer.isBuffer(bufferOrStream)) {
      const readable = new Readable();
      readable.push(bufferOrStream);
      readable.push(null);
      readable.pipe(uploadStream);
    } else if (typeof bufferOrStream.pipe === 'function') {
      bufferOrStream.pipe(uploadStream);
    } else {
      reject(new Error('Invalid buffer or stream provided to uploadAvatarToGridFS'));
    }
  });
}

/**
 * Retrieves avatar from GridFS by either ObjectId or Filename
 * @param {mongoose.Types.ObjectId|string} fileIdOrFilename
 * @returns {Promise<{ stream: import('mongodb').GridFSBucketReadStream, fileInfo: object }>}
 */
export async function downloadAvatarFromGridFS(fileIdOrFilename) {
  const gridFSBucket = getAvatarGridFSBucket();
  let query;

  if (mongoose.Types.ObjectId.isValid(fileIdOrFilename)) {
    query = { _id: new mongoose.Types.ObjectId(fileIdOrFilename) };
  } else {
    query = { filename: fileIdOrFilename };
  }

  const files = await gridFSBucket.find(query).sort({ uploadDate: -1 }).toArray();
  if (!files || files.length === 0) {
    throw new Error('Avatar image not found in GridFS');
  }

  const fileInfo = files[0];
  const downloadStream = gridFSBucket.openDownloadStream(fileInfo._id);

  return {
    stream: downloadStream,
    fileInfo,
  };
}

/**
 * Deletes an old avatar from GridFS
 * @param {mongoose.Types.ObjectId|string} fileId
 */
export async function deleteAvatarFromGridFS(fileId) {
  try {
    const gridFSBucket = getAvatarGridFSBucket();
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await gridFSBucket.delete(objectId);
  } catch (_) {
    // Ignore if already deleted
  }
}

/**
 * Uploads a buffer or stream to GridFS and returns the generated ObjectId
 * @param {string} filename
 * @param {Buffer|Readable} bufferOrStream
 * @param {string} contentType
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
export async function uploadToGridFS(filename, bufferOrStream, contentType = 'application/octet-stream') {
  const gridFSBucket = getGridFSBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType,
      metadata: { uploadedAt: new Date() },
    });

    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', () => resolve(uploadStream.id));

    if (Buffer.isBuffer(bufferOrStream)) {
      const readable = new Readable();
      readable.push(bufferOrStream);
      readable.push(null);
      readable.pipe(uploadStream);
    } else if (typeof bufferOrStream.pipe === 'function') {
      bufferOrStream.pipe(uploadStream);
    } else {
      reject(new Error('Invalid buffer or stream provided to uploadToGridFS'));
    }
  });
}

/**
 * Opens a download stream for a given GridFS file ObjectId
 * @param {mongoose.Types.ObjectId|string} fileId
 * @returns {Promise<{ stream: import('mongodb').GridFSBucketReadStream, fileInfo: object }>}
 */
export async function downloadFromGridFS(fileId) {
  const gridFSBucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

  const files = await gridFSBucket.find({ _id: objectId }).toArray();
  if (!files || files.length === 0) {
    throw new Error('Attachment not found in GridFS');
  }

  const fileInfo = files[0];
  const downloadStream = gridFSBucket.openDownloadStream(objectId);

  return {
    stream: downloadStream,
    fileInfo,
  };
}
