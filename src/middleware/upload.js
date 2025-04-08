import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const uploadDirs = [
    "./uploads/images",
    "./uploads/documents",
    "./uploads/logo",
  ];
  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureUploadDirs();

// Set up storage for images and documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "profilePhoto") {
      cb(null, "./uploads/images");
    } else if (file.fieldname === "file") {
      cb(null, "./uploads/documents");
    } else if (file.fieldname === "clogo") {
      cb(null, "./uploads/logo");
    }
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Filters for file types
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "profilePhoto") {
    // Allow only jpg/jpeg/png for profile photos
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      return cb(
        new Error(
          "Only JPG, JPEG, and PNG images are allowed for profile photos."
        )
      );
    }
  } else if (file.fieldname === "file") {
    // Allow only jpg/jpeg/png for profile photos
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      return cb(
        new Error("Only JPG, JPEG, and PNG images are allowed for documents.")
      );
    }
  } else if (file.fieldname === "clogo") {
    // Allow only jpg/jpeg/png for logo
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      return cb(
        new Error("Only JPG, JPEG, and PNG images are allowed for logo.")
      );
    }
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
});
