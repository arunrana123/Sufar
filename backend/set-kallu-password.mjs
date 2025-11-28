import mongoose from 'mongoose';

async function setPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ts-crud');
    const WorkerUser = mongoose.model('WorkerUser', new mongoose.Schema({}, { strict: false }));

    const kallu = await WorkerUser.findOne({ email: 'kallu@carpenter.com' });
    
    if (kallu) {
      kallu.password = 'worker123';
      await kallu.save();
      console.log('✅ Password set to: worker123');
      console.log('✅ Login with: kallu@carpenter.com / worker123');
    } else {
      console.log('❌ Kallu not found');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setPassword();

