import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/perkswap";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose | null> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseGlobal: MongooseCache | undefined;
}

let cached: MongooseCache = globalThis.mongooseGlobal || { conn: null, promise: null };

if (!globalThis.mongooseGlobal) {
  globalThis.mongooseGlobal = cached;
}

export async function connectMongo(): Promise<typeof mongoose | null> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 2500,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((m) => {
        console.log("[MongoDB] Connected successfully to:", MONGODB_URI.replace(/:[^:]*@/, ":****@"));
        return m;
      })
      .catch((err) => {
        console.warn("[MongoDB] Connection deferred:", err.message);
        cached.promise = null;
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch {
    cached.promise = null;
    return null;
  }
}

export default connectMongo;
