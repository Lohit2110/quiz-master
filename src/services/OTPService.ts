import emailjs from '@emailjs/browser';

// OTP Service - Email-based Authentication (No SMS required)
export class OTPService {
  private static instance: OTPService;
  private otpStorage: Map<string, { otp: string; expiresAt: number; attempts: number }> = new Map();
  private registeredStudents: Map<string, any> = new Map();
  
  // EmailJS configuration (Free email service)
  private emailConfig = {
    serviceId: 'service_quiz_otp', // Updated service ID
    templateId: 'template_quiz_otp', // Updated template ID
    publicKey: 'quiz_master_key' // Will be replaced with actual key
  };

  // Initialize EmailJS (call this to set up email service)
  private initializeEmailJS() {
    // Initialize EmailJS with a working configuration
    try {
      emailjs.init('PfWHj5-L_vUVqhkVF'); // Public key for Quiz Master
      console.log('EmailJS initialized successfully');
      return true;
    } catch (error) {
      console.error('EmailJS initialization failed:', error);
      return false;
    }
  }

  static getInstance(): OTPService {
    if (!OTPService.instance) {
      OTPService.instance = new OTPService();
    }
    return OTPService.instance;
  }

  constructor() {
    // Load registered students from localStorage
    this.loadRegisteredStudents();
    
    // Initialize EmailJS for email sending
    this.initializeEmailJS();
  }

  // Generate 6-digit OTP (like Physics Wallah)
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Load registered students from localStorage
  private loadRegisteredStudents() {
    try {
      const students = localStorage.getItem('quiz_master_registered_students');
      if (students) {
        const studentArray = JSON.parse(students);
        studentArray.forEach((student: any) => {
          // Use email as the key (not mobile)
          this.registeredStudents.set(student.email, student);
        });
        console.log(`✅ Loaded ${studentArray.length} registered students from storage`);
      }
    } catch (error) {
      console.error('Error loading registered students:', error);
    }
  }

  // Save registered students to localStorage
  private saveRegisteredStudents() {
    try {
      const studentArray = Array.from(this.registeredStudents.values());
      localStorage.setItem('quiz_master_registered_students', JSON.stringify(studentArray));
    } catch (error) {
      console.error('Error saving registered students:', error);
    }
  }

  // Register new student (Email-based registration)
  registerStudent(email: string, name: string, mobile?: string, className?: string): { success: boolean; message: string } {
    // Validate email
    if (!this.validateEmail(email)) {
      return { success: false, message: 'Please enter a valid email address' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if student already registered
    if (this.registeredStudents.has(normalizedEmail)) {
      console.log(`⚠️ Email already registered: ${normalizedEmail}`);
      return { success: false, message: 'Email already registered. Please login instead.' };
    }

    // Register new student
    const student = {
      id: `student_${Date.now()}`,
      email: normalizedEmail,
      name: name.trim(),
      mobile: mobile?.trim(),
      className: className?.trim(),
      registeredAt: Date.now(),
      totalQuizzesTaken: 0,
      lastLoginAt: null
    };

    this.registeredStudents.set(normalizedEmail, student);
    this.saveRegisteredStudents();

    // Verify save was successful
    const savedData = localStorage.getItem('quiz_master_registered_students');
    console.log(`✅ Student registered: ${name} (${normalizedEmail})`);
    console.log(`📦 Total registered students: ${this.registeredStudents.size}`);
    console.log(`💾 Saved to localStorage:`, savedData ? 'Yes' : 'No');
    
    return { success: true, message: 'Registration successful! You can now login with your email address.' };
  }

  // Check if email is registered
  isRegistered(email: string): boolean {
    return this.registeredStudents.has(email.toLowerCase());
  }

  // Get student by email
  getStudent(email: string): any | null {
    return this.registeredStudents.get(email.toLowerCase()) || null;
  }

  // Send OTP via Email (Free alternative to SMS)
  async sendOTP(email: string): Promise<{ success: boolean; message: string; demoOTP?: string }> {
    // Validate email
    if (!this.validateEmail(email)) {
      return { success: false, message: 'Please enter a valid email address' };
    }

    // Check if student is registered
    if (!this.isRegistered(email)) {
      return { success: false, message: 'Email not registered. Please register first.' };
    }

    // Check rate limiting (max 3 attempts per 5 minutes)
    const existing = this.otpStorage.get(email);
    if (existing && existing.attempts >= 3 && (Date.now() - existing.expiresAt + 300000) < 300000) {
      return { success: false, message: 'Too many OTP requests. Please try again after 5 minutes.' };
    }

    // Generate new OTP
    const otp = this.generateOTP();
    const expiresAt = Date.now() + 300000; // 5 minutes expiry

    // Store OTP
    this.otpStorage.set(email, {
      otp,
      expiresAt,
      attempts: (existing?.attempts || 0) + 1
    });

    const student = this.getStudent(email);

    try {
      // Development mode - show OTP directly
      if (process.env.NODE_ENV === 'development') {
        console.log(`� OTP for ${email}: ${otp}`);
        
        // Show OTP in a nice modal instead of alert
        const otpModal = document.createElement('div');
        otpModal.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
              <h3 style="color: #28a745; margin-bottom: 20px;">📧 OTP Sent!</h3>
              <p style="margin-bottom: 20px;">Your OTP for <strong>${email}</strong> is:</p>
              <div style="font-size: 2em; font-weight: bold; color: #007bff; background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">${otp}</div>
              <p style="color: #6c757d; font-size: 0.9em; margin-bottom: 20px;">Valid for 5 minutes</p>
              <button onclick="this.parentElement.parentElement.remove()" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Got it!</button>
            </div>
          </div>
        `;
        document.body.appendChild(otpModal);
        
        return { 
          success: true, 
          message: `OTP sent to ${email}. Check the modal above!`,
          demoOTP: otp
        };
      }

      // Production mode - Send actual email (requires EmailJS setup)
      if (this.emailConfig.serviceId !== 'service_quiz_master') {
        await emailjs.send(
          this.emailConfig.serviceId,
          this.emailConfig.templateId,
          {
            to_email: email,
            student_name: student?.name || 'Student',
            otp: otp,
            expires_in: '5 minutes'
          },
          this.emailConfig.publicKey
        );
      }

      return { 
        success: true, 
        message: `OTP sent to ${email}. Please check your inbox (and spam folder).`
      };

    } catch (error) {
      console.error('Email sending failed:', error);
      
      // Fallback to demo mode if email fails
      console.log(`📧 Email failed, showing OTP: ${otp}`);
      alert(`Email service unavailable. Your OTP is: ${otp}`);
      
      return { 
        success: true, 
        message: `Email service unavailable. Your OTP is displayed above.`,
        demoOTP: otp
      };
    }
  }

  // Verify OTP and login (same as before but with email)
  verifyOTP(email: string, enteredOTP: string): { success: boolean; message: string; student?: any } {
    const normalizedEmail = email.toLowerCase();
    const storedData = this.otpStorage.get(normalizedEmail);

    if (!storedData) {
      return { success: false, message: 'No OTP found. Please request a new OTP.' };
    }

    // Check if OTP expired
    if (Date.now() > storedData.expiresAt) {
      this.otpStorage.delete(normalizedEmail);
      return { success: false, message: 'OTP has expired. Please request a new OTP.' };
    }

    // Verify OTP
    if (storedData.otp !== enteredOTP.trim()) {
      return { success: false, message: 'Invalid OTP. Please check and try again.' };
    }

    // OTP verified successfully
    this.otpStorage.delete(normalizedEmail); // Remove used OTP
    
    // Get student data
    const student = this.getStudent(normalizedEmail);
    if (student) {
      // Update last login
      student.lastLoginAt = Date.now();
      this.registeredStudents.set(normalizedEmail, student);
      this.saveRegisteredStudents();

      console.log(`Student logged in: ${student.name} (${normalizedEmail})`);
      return { 
        success: true, 
        message: 'Login successful!', 
        student 
      };
    }

    return { success: false, message: 'Student data not found.' };
  }

  // Validate email address
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  // Validate Indian mobile number (keeping for backward compatibility)
  private validateMobileNumber(mobile: string): boolean {
    // Remove spaces and special characters
    const cleanMobile = mobile.replace(/\D/g, '');
    
    // Check if it's 10 digits and starts with 6-9
    return /^[6-9]\d{9}$/.test(cleanMobile);
  }

  // Get all registered students (admin only)
  getAllStudents(): any[] {
    return Array.from(this.registeredStudents.values());
  }

  // Get registration statistics
  getRegistrationStats() {
    const students = Array.from(this.registeredStudents.values());
    const now = Date.now();
    const dayAgo = now - 86400000;
    const weekAgo = now - 604800000;

    return {
      totalStudents: students.length,
      todayRegistrations: students.filter(s => s.registeredAt > dayAgo).length,
      weekRegistrations: students.filter(s => s.registeredAt > weekAgo).length,
      activeStudents: students.filter(s => s.lastLoginAt && s.lastLoginAt > weekAgo).length
    };
  }

  // Resend OTP (with rate limiting)
  async resendOTP(email: string): Promise<{ success: boolean; message: string; demoOTP?: string }> {
    return await this.sendOTP(email);
  }

  // Clear expired OTPs (cleanup)
  clearExpiredOTPs() {
    const now = Date.now();
    const entries = Array.from(this.otpStorage.entries());
    for (const [mobile, data] of entries) {
      if (now > data.expiresAt) {
        this.otpStorage.delete(mobile);
      }
    }
  }

  // Get pending OTP info (for debugging)
  getPendingOTP(email: string): { hasOTP: boolean; expiresIn?: number; attempts?: number } {
    const data = this.otpStorage.get(email.toLowerCase());
    if (!data) {
      return { hasOTP: false };
    }

    const expiresIn = Math.max(0, data.expiresAt - Date.now());
    return {
      hasOTP: true,
      expiresIn,
      attempts: data.attempts
    };
  }

  // Setup EmailJS (call this once to configure email service)
  setupEmailService(serviceId: string, templateId: string, publicKey: string) {
    this.emailConfig = {
      serviceId,
      templateId,
      publicKey
    };
    console.log('EmailJS configured for OTP delivery');
  }

  // Alternative: Simple passcode login (no OTP required)
  createSimplePasscode(email: string, name: string, className?: string): { success: boolean; passcode: string; message: string } {
    if (!this.validateEmail(email)) {
      return { success: false, passcode: '', message: 'Please enter a valid email address' };
    }

    // Generate a simple 6-character passcode
    const passcode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const student = {
      id: `student_${Date.now()}`,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      className: className?.trim(),
      passcode: passcode,
      registeredAt: Date.now(),
      totalQuizzesTaken: 0,
      lastLoginAt: null,
      authType: 'passcode' // Different from OTP auth
    };

    this.registeredStudents.set(email.toLowerCase(), student);
    this.saveRegisteredStudents();

    return {
      success: true,
      passcode: passcode,
      message: `Registration successful! Your login passcode is: ${passcode}. Please save it safely.`
    };
  }

  // Login with simple passcode
  loginWithPasscode(email: string, passcode: string): { success: boolean; message: string; student?: any } {
    const student = this.getStudent(email.toLowerCase());
    
    if (!student) {
      return { success: false, message: 'Email not registered. Please register first.' };
    }

    if (student.passcode !== passcode.toUpperCase()) {
      return { success: false, message: 'Invalid passcode. Please check and try again.' };
    }

    // Update last login
    student.lastLoginAt = Date.now();
    this.registeredStudents.set(email.toLowerCase(), student);
    this.saveRegisteredStudents();

    return {
      success: true,
      message: 'Login successful!',
      student
    };
  }
}

export const otpService = OTPService.getInstance();