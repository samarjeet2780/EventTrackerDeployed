
const express = require('express');
const nunjucks = require('nunjucks');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const {MONGODB, SESSION} = require("./credentials");
const { seedUser, User, hashPassword } = require("./auth");  // Import from auth.js

const app = express();
const port = 3000;

// MongoDB connection URI
const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.password}@cluster0.ewes8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);
seedUser(uri);
let db;

// Mongoose Schema and Model for Task with Validation
const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        minlength: [3, 'Title must be at least 3 characters long'],
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        minlength: [5, 'Description must be at least 5 characters long'],
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required'],
    },
    file: {
        type: String, // Filename stored here
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

const Task = mongoose.model('Task', taskSchema);

// Connect to MongoDB and Mongoose
async function connectToDB() {
    try {
        await client.connect();
        db = client.db('TODO'); // Replace with your database name
        console.log('Connected to MongoDB successfully');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }

    // Connect Mongoose
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to Mongoose');
    } catch (error) {
        console.error('Error connecting to Mongoose:', error);
    }
}

connectToDB();

// Configure Nunjucks templating engine
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

// Middleware for parsing form data and serving static files
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Session middleware (cookie-based sessions)
app.use(session({
    secret: SESSION.secret, // Change this to something more secure
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Change to 'true' if using https
}));

// Multer setup for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Uploaded files go to uploads folder
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Routes
app.get('/register', (req, res) => {
    res.render('register.njk');  // Render the register form
});


app.post('/register', async (req, res) => {
    const { username, password } = req.body;  // Getting username and password from the request body
    
    try {
        // Step 1: Hash the password and get the salt
        const { hashedPassword, salt } = await hashPassword(password);

        // Step 2: Create a new user with the hashed password and the salt
        const newUser = new User({
            user: username,
            hash: hashedPassword, // Store the full bcrypt hash
            salt: salt            // Store the generated salt
        });

        // Step 3: Save the new user to the database
        const result = await newUser.save();
        console.log('User registered:', result);

        // Step 4: Redirect to login or send a success message
        res.redirect('/login');
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Registration failed');
    }
});





app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login page if not logged in
    }
    try {
        const tasks = await db.collection('tasks').find({}).toArray();
        res.render('index.njk', { tasks, session: req.session });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).render('500.njk');
    }
});

app.get('/login', (req, res) => {
    res.render('login.njk'); // Render login page
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Hardcoded credentials for simplicity (replace with a real user authentication system)
    if (username === 'user' && password === 'password') {
        req.session.user = { username }; // Store user info in session
        res.redirect('/'); // Redirect to homepage after login
    } else {
        res.status(400).json({ error: 'Invalid credentials' });
    }
});

// app.post('/login', async (req, res) => {
//     const { username, password } = req.body;

//     try {
//         // Find the user by username from the database
//         const user = await User.findOne({ user: username });

//         if (!user) {
//             return res.status(400).json({ error: 'Invalid credentials' });
//         }

//         // Compare the entered password with the stored hashed password
//         const isMatch = await bcrypt.compare(password, user.hash);

//         if (isMatch) {
//             req.session.user = { username }; // Store user info in session
//             res.redirect('/'); // Redirect to homepage after login
//         } else {
//             res.status(400).json({ error: 'Invalid credentials' });
//         }
//     } catch (error) {
//         console.error('Error during login:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Failed to log out');
        }
        res.redirect('/login'); // Redirect to login page after logout
    });
});

// Route to add a task with file upload
app.post('/add-task', upload.single('file'), async (req, res) => {
    const { title, description, dueDate } = req.body;
    const file = req.file ? req.file.filename : null;

    // Create a new task instance
    const newTask = new Task({
        title,
        description,
        dueDate,
        file,
    });

    try {
        // Validate the task instance
        await newTask.validate(); // Mongoose validation

        // Convert the validated task into a plain object
        const taskObject = {
            title: newTask.title,
            description: newTask.description,
            dueDate: newTask.dueDate,
            file: newTask.file,
            createdAt: new Date(), // Include a creation timestamp
        };

        // Explicitly add the task to the MongoDB collection
        const result = await db.collection('tasks').insertOne(taskObject);

        // Attach the generated ID to the response
        taskObject._id = result.insertedId;

        // Send response with the newly added task
        res.status(201).json(taskObject);
    } catch (error) {
        console.error('Error adding task:', error);

        // Send validation or server error
        if (error.name === 'ValidationError') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error adding task to database' });
        }
    }
});

// Fetch a single task
app.get('/task/:id', async (req, res) => {
    try {
        const taskId = new ObjectId(req.params.id);
        const task = await db.collection('tasks').findOne({ _id: taskId });
        if (task) {
            res.render('task.njk', { task });
        } else {
            res.status(404).render('404.njk');
        }
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).render('500.njk');
    }
});

// Route to download a file
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'uploads', req.params.filename);
    res.download(filePath);
});

// Custom 404 error handler
app.use((req, res) => {
    res.status(404).render('404.njk');
});

// Custom 500 error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500.njk');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
