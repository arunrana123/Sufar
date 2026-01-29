/**
 * One-off script: Set worker "Arun Rana" (carpenter) as verified so QR code can be generated.
 * Run from backend: node scripts/verify-worker-arun.mjs (or bun run scripts/verify-worker-arun.mjs)
 * Uses MONGO_URI from env or mongodb://localhost:27017/ts-crud
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const WorkerUserSchema = new mongoose.Schema({
  name: String,
  email: String,
  serviceCategories: [String],
  verificationStatus: mongoose.Schema.Types.Mixed,
  categoryVerificationStatus: mongoose.Schema.Types.Mixed,
}, { strict: false });

const WorkerUser = mongoose.models.WorkerUser || mongoose.model('WorkerUser', WorkerUserSchema);

async function verifyWorkerArun() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ts-crud';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find worker by name (case-insensitive: arun rana)
    const worker = await WorkerUser.findOne({
      $or: [
        { name: /arun\s+rana/i },
        { name: 'arun rana' },
        { name: 'Arun Rana' },
      ],
    });

    if (!worker) {
      console.log('❌ Worker "Arun Rana" not found. Listing workers with "arun" or "carpenter":');
      const any = await WorkerUser.find({
        $or: [
          { name: /arun/i },
          { serviceCategories: /carpenter/i },
        ],
      }).select('name email serviceCategories verificationStatus categoryVerificationStatus').lean();
      console.log(JSON.stringify(any, null, 2));
      await mongoose.disconnect();
      process.exit(1);
    }

    // Resolve carpenter category: use existing from serviceCategories or add "Carpenter"
    const existingCats = worker.serviceCategories || [];
    const carpenterKey = existingCats.find((c) => /carpenter/i.test(String(c))) || 'Carpenter';
    const serviceCategories = existingCats.some((c) => /carpenter/i.test(String(c)))
      ? existingCats
      : [...existingCats, carpenterKey];

    const currentVerification = worker.verificationStatus && typeof worker.verificationStatus === 'object'
      ? worker.verificationStatus
      : { profilePhoto: 'pending', certificate: 'pending', citizenship: 'pending', license: 'pending', overall: 'pending' };
    const verificationStatus = {
      ...currentVerification,
      overall: 'verified',
    };

    const currentCategoryStatus = worker.categoryVerificationStatus && typeof worker.categoryVerificationStatus === 'object'
      ? worker.categoryVerificationStatus
      : {};
    const categoryVerificationStatus = {
      ...currentCategoryStatus,
      [carpenterKey]: 'verified',
    };

    worker.serviceCategories = serviceCategories;
    worker.verificationStatus = verificationStatus;
    worker.categoryVerificationStatus = categoryVerificationStatus;
    await worker.save();

    console.log('✅ Worker updated:', worker.name, worker.email);
    console.log('   serviceCategories:', worker.serviceCategories);
    console.log('   verificationStatus.overall:', worker.verificationStatus?.overall);
    console.log('   categoryVerificationStatus:', worker.categoryVerificationStatus);
    console.log('   QR code should now be allowed for this verified worker.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

verifyWorkerArun();
