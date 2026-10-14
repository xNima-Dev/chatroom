const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_secret_for_unit_and_integration_testing_32chars';
  
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.14',
      systemBinary: '/Users/mac/.cache/mongodb-binaries/mongod-x64-darwin-7.0.14'
    }
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    driverInfo: {
      name: 'nodejs',
      version: '6.0.0'
    }
  });
}, 60000);

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
