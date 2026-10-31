import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDb() {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
