const fs = require('fs');
const path = require('path');

// Function to create directory
function createDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }
}

// Define the root folder
const rootFolder = path.join(__dirname, 'dataToMigrate');
createDirectory(rootFolder);

// Date range setup
const startDate = new Date(2023, 2); // March 2023
const endDate = new Date(2024, 7); // August 2024

// Alphabet increment
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Create directories for each month in the range
for (let i = 0, date = new Date(startDate); date <= endDate; date.setMonth(date.getMonth() + 1), i++) {
  const monthName = date.toLocaleString('default', { month: 'long' }).toLowerCase();
  const year = date.getFullYear();
  const folderName = `${alphabet[i % 26]}-${monthName}-${year}`;
  const folderPath = path.join(rootFolder, folderName);
  createDirectory(folderPath);
}
