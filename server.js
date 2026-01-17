const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cors = require("cors");
const db = require("./db");
const app = express();

// Middleware
app.use(express.json());
app.use(cors()); // Allows frontend to talk to backend

// 1. Razorpay Configuration
const razorpay = new Razorpay({
  key_id: "YOUR_RAZORPAY_KEY_ID",     // Replace with actual Key ID
  key_secret: "YOUR_RAZORPAY_SECRET"  // Replace with actual Key Secret
});

// 2. Create Order Endpoint
app.post("/create-order", async (req, res) => {
  try {
    const options = {
      amount: req.body.amount * 100, // Amount in paise (e.g., 100 INR = 10000 paise)
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send("Error creating order");
  }
});

// 3. Verify Payment & Send Notifications
app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, name, phone, amount, message } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", "YOUR_RAZORPAY_SECRET") // Same secret as above
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    // Payment Successful
    console.log("Payment Verified");

    // Save to MySQL Database
    const sql = `
      INSERT INTO donations 
      (name, email, phone, amount, message, payment_id, order_id, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
      name, email, phone, amount, message, 
      razorpay_payment_id, razorpay_order_id, "SUCCESS"
    ], (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ status: "error", message: "Database error" });
      }

      // Send Email (Async - don't wait for it to respond to user)
      if (email) {
        sendThankYouEmail(email, name, amount);
      }
      
      // Send SMS (Placeholder)
      // sendSMS(phone, name);

      res.json({ status: "success" });
    });
  } else {
    res.status(400).json({ status: "failed" });
  }
});

// 5. Admin: View Donations
app.get("/admin/donations", (req, res) => {
  db.query("SELECT * FROM donations ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

// 4. Email Logic (Nodemailer)
async function sendThankYouEmail(userEmail, userName, amount) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "your-ngo-email@gmail.com", // Your Email
      pass: "your-app-password"         // App Password (Not regular password)
    }
  });

  let info = await transporter.sendMail({
    from: '"Little Hearts Foundation" <your-ngo-email@gmail.com>',
    to: userEmail,
    subject: "Thank You for Your Donation! ❤️",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #ff1493;">Dear ${userName},</h2>
        <p>Thank you for your generous donation of <strong>₹${amount}</strong>.</p>
        <p>Your support helps us provide food, shelter, and education to children in need.</p>
        <br>
        <p>With gratitude,</p>
        <p><strong>The Little Hearts Team</strong></p>
      </div>
    `
  });

  console.log("Email sent: %s", info.messageId);
}

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});