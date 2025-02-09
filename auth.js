

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define the User schema
const userSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true,
    },
    hash: {
        type: String,
        required: true,
    },
    salt: {
        type: String,
        required: true,
    }
});

// User model
const User = mongoose.model('User', userSchema);

// Hashing function
// Hashing function
function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const saltRounds = 10;
        bcrypt.genSalt(saltRounds, (err, salt) => {  // Use genSalt to generate salt
            if (err) reject(err);
            bcrypt.hash(password, salt, (err, hashed) => {
                if (err) reject(err);
                resolve({ hashedPassword: hashed, salt: salt });
            });
        });
    });
}


// User Seeding Function (Only run once for testing or initialization)
async function seedUser(uri) {
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to MongoDB for seeding.");

        // Drop collection before seeding for testing purposes
        await mongoose.connection.db.dropCollection('users');
        console.log("Collection 'users' dropped for seeding.");

        const { hashedPassword, salt } = await hashPassword("SuperSecret");

        const newUser = new User({
            user: "Admin",  // Admin username
            hash: hashedPassword,
            salt: salt
        });

        const result = await newUser.save();
        console.log("Seeded User:", result);
    } catch (error) {
        console.error("Error during seeding:", error);
    }
}



module.exports = { User, seedUser, hashPassword };

