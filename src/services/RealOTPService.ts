/**
 * Real OTP Service - Sends actual SMS and Email OTPs
 * Uses Twilio for SMS and EmailJS for Email delivery
 * Similar to PhysicsWallah, Unacademy, and other EdTech platforms
 */

import emailjs from '@emailjs/browser';

export interface StudentData {
  id: string;
  mobile?: string;
  email?: string;
  name: string;
  className?: string;
  registeredAt: number;
  lastLoginAt: number | null;
  totalQuizzesTaken: number;
  authType: 'mobile' | 'email';
}

export class RealOTPService {
  private static instance: RealOTPService;
  private otpStorage: Map<string, { otp: string; expiresAt: number; attempts: number }> = new Map();
  private registeredStudents: Map<string, StudentData> = new Map();

  // Twilio Configuration (for SMS OTP)
  // NOTE: Do NOT hardcode credentials here — they will be rejected by GitHub secret scanning.
  // Call configureTwilio() at runtime to set these, or leave empty for development mode.
  private twilioConfig = {
    accountSid: '',
    authToken: '',
    verifyServiceSid: '', // Twilio Verify Service SID
  };

  // EmailJS Configuration (for Email OTP)
  private emailConfig = {
    serviceId: '', // Get from https://dashboard.emailjs.com/
    templateId: '', // Create template with OTP
    publicKey: '', // Your EmailJS public key
  };

  // Twilio API endpoint
  private readonly TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

  static getInstance(): RealOTPService {
    if (!RealOTPService.instance) {
      RealOTPService.instance = new RealOTPService();
    }
    return RealOTPService.instance;
  }

  constructor() {
    this.loadRegisteredStudents();
    this.initializeEmailJS();
  }

  /**
   * Configure Twilio for SMS OTP
   * Get credentials from: https://console.twilio.com/
   */
  configureTwilio(accountSid: string, authToken: string, verifyServiceSid: string) {
    this.twilioConfig = { accountSid, authToken, verifyServiceSid };
    console.log('✅ Twilio SMS configured successfully');
  }

  /**
   * Configure EmailJS for Email OTP
   * Get credentials from: https://dashboard.emailjs.com/
   */
  configureEmailJS(serviceId: string, templateId: string, publicKey: string) {
    this.emailConfig = { serviceId, templateId, publicKey };
    this.initializeEmailJS();
    console.log('✅ EmailJS configured successfully');
  }

  /**
   * Initialize EmailJS
   */
  private initializeEmailJS() {
    if (this.emailConfig.publicKey) {
      try {
        emailjs.init(this.emailConfig.publicKey);
        console.log('✅ EmailJS initialized');
      } catch (error) {
        console.error('❌ EmailJS initialization failed:', error);
      }
    }
  }

  /**
   * Register student with mobile number
   */
  registerWithMobile(mobile: string, name: string, className?: string): { success: boolean; message: string } {
    const cleanMobile = this.cleanMobileNumber(mobile);

    if (!this.validateMobileNumber(cleanMobile)) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number' };
    }

    if (this.registeredStudents.has(cleanMobile)) {
      return { success: false, message: 'Mobile number already registered. Please login instead.' };
    }

    const student: StudentData = {
      id: `student_${Date.now()}`,
      mobile: cleanMobile,
      name: name.trim(),
      className: className?.trim(),
      registeredAt: Date.now(),
      lastLoginAt: null,
      totalQuizzesTaken: 0,
      authType: 'mobile',
    };

    this.registeredStudents.set(cleanMobile, student);
    this.saveRegisteredStudents();

    console.log(`✅ Student registered with mobile: ${name} (${cleanMobile})`);
    return { success: true, message: 'Registration successful! You can now login with OTP.' };
  }

  /**
   * Register student with email
   */
  registerWithEmail(email: string, name: string, className?: string): { success: boolean; message: string } {
    const cleanEmail = email.toLowerCase().trim();

    if (!this.validateEmail(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address' };
    }

    if (this.registeredStudents.has(cleanEmail)) {
      return { success: false, message: 'Email already registered. Please login instead.' };
    }

    const student: StudentData = {
      id: `student_${Date.now()}`,
      email: cleanEmail,
      name: name.trim(),
      className: className?.trim(),
      registeredAt: Date.now(),
      lastLoginAt: null,
      totalQuizzesTaken: 0,
      authType: 'email',
    };

    this.registeredStudents.set(cleanEmail, student);
    this.saveRegisteredStudents();

    console.log(`✅ Student registered with email: ${name} (${cleanEmail})`);
    return { success: true, message: 'Registration successful! You can now login with OTP.' };
  }

  /**
   * Send SMS OTP using Twilio
   */
  async sendSMSOTP(mobile: string): Promise<{ success: boolean; message: string }> {
    const cleanMobile = this.cleanMobileNumber(mobile);

    if (!this.validateMobileNumber(cleanMobile)) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number' };
    }

    if (!this.registeredStudents.has(cleanMobile)) {
      return { success: false, message: 'Mobile number not registered. Please register first.' };
    }

    try {
      // Check if Twilio is configured
      if (!this.twilioConfig.accountSid || !this.twilioConfig.authToken || !this.twilioConfig.verifyServiceSid) {
        console.warn('⚠️ Twilio not configured - Using development mode');

        // Development mode: Generate local OTP
        const otp = this.generateOTP();
        const expiresAt = Date.now() + 300000; // 5 minutes

        // Check rate limiting
        const existing = this.otpStorage.get(cleanMobile);
        if (existing && existing.attempts >= 3) {
          const timeSinceFirst = Date.now() - (existing.expiresAt - 300000);
          if (timeSinceFirst < 300000) {
            return { success: false, message: 'Too many OTP requests. Please try again after 5 minutes.' };
          }
        }

        // Store OTP locally
        this.otpStorage.set(cleanMobile, {
          otp,
          expiresAt,
          attempts: (existing?.attempts || 0) + 1,
        });

        return this.showDevelopmentOTP(cleanMobile, otp, 'SMS');
      }

      // Production mode: Use Twilio Verify (no local OTP needed)
      const toNumber = `+91${cleanMobile}`; // Add +91 for Indian numbers

      console.log(`📱 Sending SMS OTP to ${toNumber} via Twilio Verify...`);
      await this.sendTwilioVerifyOTP(toNumber);

      console.log(`✅ SMS OTP sent to ${cleanMobile} via Twilio`);

      // Mark that we've sent OTP via Twilio (for tracking)
      this.otpStorage.set(cleanMobile, {
        otp: 'TWILIO_VERIFY', // Flag to indicate Twilio Verify is handling OTP
        expiresAt: Date.now() + 300000,
        attempts: 1,
      });

      return {
        success: true,
        message: `OTP sent to your mobile number ${this.maskMobile(cleanMobile)} via SMS`
      };

    } catch (error: any) {
      console.error('❌ Twilio SMS sending failed:', error);
      console.error('Error details:', error.message);

      // Fallback to development mode
      const otp = this.generateOTP();
      const expiresAt = Date.now() + 300000;

      this.otpStorage.set(cleanMobile, {
        otp,
        expiresAt,
        attempts: 1,
      });

      return this.showDevelopmentOTP(cleanMobile, otp, 'SMS');
    }
  }

  /**
   * Send Email OTP using EmailJS
   */
  async sendEmailOTP(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.toLowerCase().trim();

    if (!this.validateEmail(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address' };
    }

    if (!this.registeredStudents.has(cleanEmail)) {
      return { success: false, message: 'Email not registered. Please register first.' };
    }

    // Check rate limiting
    const existing = this.otpStorage.get(cleanEmail);
    if (existing && existing.attempts >= 3) {
      const timeSinceFirst = Date.now() - (existing.expiresAt - 300000);
      if (timeSinceFirst < 300000) {
        return { success: false, message: 'Too many OTP requests. Please try again after 5 minutes.' };
      }
    }

    // Generate OTP
    const otp = this.generateOTP();
    const expiresAt = Date.now() + 300000; // 5 minutes

    // Store OTP
    this.otpStorage.set(cleanEmail, {
      otp,
      expiresAt,
      attempts: (existing?.attempts || 0) + 1,
    });

    try {
      // Check if EmailJS is configured
      if (!this.emailConfig.serviceId || !this.emailConfig.templateId || !this.emailConfig.publicKey) {
        console.warn('⚠️ EmailJS not configured - Using development mode');
        return this.showDevelopmentOTP(cleanEmail, otp, 'Email');
      }

      const student = this.registeredStudents.get(cleanEmail);

      // Send Email via EmailJS
      await emailjs.send(
        this.emailConfig.serviceId,
        this.emailConfig.templateId,
        {
          to_email: cleanEmail,
          to_name: student?.name || 'Student',
          otp_code: otp,
          expiry_time: '5 minutes',
        },
        this.emailConfig.publicKey
      );

      console.log(`✅ Email OTP sent to ${cleanEmail}`);
      return {
        success: true,
        message: `OTP sent to your email ${this.maskEmail(cleanEmail)}`
      };

    } catch (error: any) {
      console.error('❌ Email sending failed:', error);

      // Fallback to development mode
      return this.showDevelopmentOTP(cleanEmail, otp, 'Email');
    }
  }

  /**
   * Send SMS OTP using Twilio Verify API (better than regular SMS)
   */
  private async sendTwilioVerifyOTP(toNumber: string): Promise<void> {
    const url = `https://verify.twilio.com/v2/Services/${this.twilioConfig.verifyServiceSid}/Verifications`;

    console.log('📡 Twilio API Request:');
    console.log('  URL:', url);
    console.log('  To:', toNumber);
    console.log('  Account SID:', this.twilioConfig.accountSid);
    console.log('  Verify Service:', this.twilioConfig.verifyServiceSid);

    const formData = new URLSearchParams();
    formData.append('To', toNumber);
    formData.append('Channel', 'sms');

    const credentials = btoa(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ Twilio API Error:', error);
      throw new Error(error.message || `SMS sending failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Twilio Response:', data);
  }

  /**
   * Verify OTP using Twilio Verify API
   */
  private async verifyTwilioOTP(toNumber: string, code: string): Promise<boolean> {
    const url = `https://verify.twilio.com/v2/Services/${this.twilioConfig.verifyServiceSid}/VerificationCheck`;

    const formData = new URLSearchParams();
    formData.append('To', toNumber);
    formData.append('Code', code);

    const credentials = btoa(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'approved';
  }

  /**
   * Verify OTP
   */
  async verifyOTP(identifier: string, enteredOTP: string): Promise<{ success: boolean; message: string; student?: StudentData }> {
    // Clean identifier (mobile or email)
    const cleanIdentifier = identifier.includes('@')
      ? identifier.toLowerCase().trim()
      : this.cleanMobileNumber(identifier);

    const student = this.registeredStudents.get(cleanIdentifier);
    if (!student) {
      return { success: false, message: 'Student not found. Please register first.' };
    }

    // For mobile numbers with Twilio Verify configured, use Twilio API
    if (student.authType === 'mobile' && this.twilioConfig.verifyServiceSid) {
      try {
        const toNumber = `+91${cleanIdentifier}`;
        const isValid = await this.verifyTwilioOTP(toNumber, enteredOTP);

        if (!isValid) {
          return { success: false, message: 'Invalid OTP. Please check and try again.' };
        }

        // OTP verified successfully via Twilio
        student.lastLoginAt = Date.now();
        this.registeredStudents.set(cleanIdentifier, student);
        this.saveRegisteredStudents();
        this.otpStorage.delete(cleanIdentifier);

        console.log(`✅ Student logged in: ${student.name} (via Twilio Verify)`);
        return { success: true, message: 'Login successful!', student };
      } catch (error) {
        console.error('Twilio verification error:', error);
        // Fall through to local verification
      }
    }

    // For email or fallback: use local OTP storage
    const storedData = this.otpStorage.get(cleanIdentifier);

    if (!storedData) {
      return { success: false, message: 'No OTP found. Please request a new OTP.' };
    }

    // Check if OTP expired
    if (Date.now() > storedData.expiresAt) {
      this.otpStorage.delete(cleanIdentifier);
      return { success: false, message: 'OTP has expired. Please request a new OTP.' };
    }

    // Verify OTP
    if (storedData.otp !== enteredOTP.trim()) {
      return { success: false, message: 'Invalid OTP. Please check and try again.' };
    }

    // OTP verified successfully
    this.otpStorage.delete(cleanIdentifier);

    // Update student last login
    student.lastLoginAt = Date.now();
    this.registeredStudents.set(cleanIdentifier, student);
    this.saveRegisteredStudents();

    console.log(`✅ Student logged in: ${student.name} (via local OTP)`);
    return { success: true, message: 'Login successful!', student };
  }

  /**
   * Development mode - Show OTP in modal (when services not configured)
   */
  private showDevelopmentOTP(identifier: string, otp: string, type: 'SMS' | 'Email'): { success: boolean; message: string } {
    console.log(`🔐 Development Mode - ${type} OTP for ${identifier}: ${otp}`);

    // Show OTP in modal
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
        <div style="background: white; padding: 40px; border-radius: 15px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-width: 400px;">
          <div style="font-size: 3rem; margin-bottom: 20px;">${type === 'SMS' ? '📱' : '📧'}</div>
          <h3 style="color: #28a745; margin-bottom: 10px;">Development Mode</h3>
          <p style="color: #6c757d; margin-bottom: 20px;">
            ${type === 'SMS' ? 'SMS' : 'Email'} OTP for testing:
          </p>
          <div style="font-size: 2.5em; font-weight: bold; color: #007bff; background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; letter-spacing: 0.3em;">${otp}</div>
          <p style="color: #6c757d; font-size: 0.9em; margin-bottom: 20px;">
            <strong>To:</strong> ${type === 'SMS' ? this.maskMobile(identifier) : this.maskEmail(identifier)}<br>
            <strong>Valid for:</strong> 5 minutes
          </p>
          <p style="color: #dc3545; font-size: 0.85em; margin-bottom: 20px;">
            ⚠️ Configure ${type === 'SMS' ? 'Twilio' : 'EmailJS'} for production use
          </p>
          <button onclick="this.parentElement.parentElement.remove()" style="background: #28a745; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-size: 1em; font-weight: 600;">
            Got it!
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    return {
      success: true,
      message: `${type} service not configured. Check the popup for OTP.`,
    };
  }

  // Helper methods
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private validateMobileNumber(mobile: string): boolean {
    return /^[6-9]\d{9}$/.test(mobile);
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private cleanMobileNumber(mobile: string): string {
    return mobile.replace(/\D/g, '');
  }

  private maskMobile(mobile: string): string {
    return `******${mobile.slice(-4)}`;
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1);
    return `${maskedName}@${domain}`;
  }

  private loadRegisteredStudents() {
    try {
      const data = localStorage.getItem('quiz_master_students_v2');
      if (data) {
        const students: StudentData[] = JSON.parse(data);
        students.forEach(student => {
          const key = student.authType === 'mobile' ? student.mobile! : student.email!;
          this.registeredStudents.set(key, student);
        });
        console.log(`✅ Loaded ${students.length} registered students`);
      }
    } catch (error) {
      console.error('❌ Error loading students:', error);
    }
  }

  private saveRegisteredStudents() {
    try {
      const students = Array.from(this.registeredStudents.values());
      localStorage.setItem('quiz_master_students_v2', JSON.stringify(students));
    } catch (error) {
      console.error('❌ Error saving students:', error);
    }
  }

  // Check if student is registered
  isRegistered(identifier: string): boolean {
    const clean = identifier.includes('@')
      ? identifier.toLowerCase().trim()
      : this.cleanMobileNumber(identifier);
    return this.registeredStudents.has(clean);
  }

  // Get student data
  getStudent(identifier: string): StudentData | null {
    const clean = identifier.includes('@')
      ? identifier.toLowerCase().trim()
      : this.cleanMobileNumber(identifier);
    return this.registeredStudents.get(clean) || null;
  }

  // Get all students (admin only)
  getAllStudents(): StudentData[] {
    return Array.from(this.registeredStudents.values());
  }

  // Resend OTP
  async resendOTP(identifier: string, type: 'mobile' | 'email'): Promise<{ success: boolean; message: string }> {
    if (type === 'mobile') {
      return await this.sendSMSOTP(identifier);
    } else {
      return await this.sendEmailOTP(identifier);
    }
  }
}

export const realOTPService = RealOTPService.getInstance();
