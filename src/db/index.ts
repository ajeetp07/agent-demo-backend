import mongoose from "mongoose";
import envConfig from "@/config/env";
import { MongoMemoryServer } from "mongodb-memory-server";

// ------------
// Dev/Prod DB
// ------------
const connectDB = async () => {
  try {
    await mongoose.connect(envConfig.DB_PATH);
    console.log(`Connected to DB ${envConfig.DB_PATH}`);
  } catch (err) {
    console.log(`Error connecting to DB ${err}`);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log(`Disconnected!`);
  } catch (err) {
    console.log(`Error disconnecting from DB ${err}`);
  }
};

// --------
// Test DB
// --------
let mongoServer: MongoMemoryServer | null = null;

const connectTestDB = async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log(`Connected to in-memory DB`);
  } catch (err) {
    console.log(`Error connecting to in-memory DB ${err}`);
  }
};

const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    console.log(`Cleared in-memory DB!`);
  } catch (err) {
    console.log(`Error clearing in-memory DB ${err}`);
  }
};

const disconnectTestDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log(`Disconnected from in-memory DB!`);
  } catch (err) {
    console.log(`Error disconnecting from in-memory DB ${err}`);
  }
};

export {
  clearTestDB,
  connectDB,
  connectTestDB,
  disconnectDB,
  disconnectTestDB,
};
