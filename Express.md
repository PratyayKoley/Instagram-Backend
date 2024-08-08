# Express

1. **bcrypt** : This library is used for hashing passwords. It helps in securely storing passwords in your database by converting them into a hashed format, which is difficult to reverse-engineer. This is essential for protecting user data. It generates a salt and adds it to the passwords.
2. **body-parser** : It is used to receive the data which is send from the frontend making the req.body property available. It receives the data in a json format.
3. **cors** : It is used to enable the cross origin. CORS is a security feature implemented by browsers to restrict web pages from making requests to a different domain than the one that served the web page. This library helps you configure and manage these permissions.
4. **dotenv** : This module loads environment variables from a .env file. This .env file stores the values which needs to be hidden from the user such as port numbers, passwords, etc.
5. **pg** : This is the PostgreSQL client for Node.js. It is used to interact with a PostgreSQL database, allowing you to execute SQL queries and manage your database directly from your Node.js application.
