import jsPDF from 'jspdf';
import { QuizResult, QuizQuestion } from '../types';

export class PDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private currentY: number;
  private lineHeight: number;

  constructor() {
    this.pdf = new jsPDF();
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
    this.lineHeight = 6;
  }

  async generateQuizReport(result: QuizResult, questions: QuizQuestion[]): Promise<void> {
    console.log('=== PDF GENERATION START ===');
    console.log('Questions received:', questions.length);
    console.log('Quiz result:', result);

    // Add cover page
    this.addCoverPage(result);
    
    // Add summary page
    this.addSummaryPage(result);

    // Add questions - one per page
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const detailedResult = result.detailedResults.find(dr => dr.questionId === question.id);
      
      console.log(`Processing question ${i + 1}:`, {
        question: question.question,
        hasImage: !!question.imageUrl,
        imageUrl: question.imageUrl
      });

      // Start new page for each question
      this.pdf.addPage();
      this.currentY = this.margin;
      
      await this.addQuestionPage(question, detailedResult, i + 1);
    }

    // Add footers to all pages
    this.addFooters();

    console.log('=== PDF GENERATION COMPLETE ===');
  }

  private addCoverPage(result: QuizResult): void {
    // Header
    this.pdf.setFontSize(24);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setTextColor(33, 37, 41);
    this.pdf.text('Quiz Results Report', this.pageWidth / 2, 40, { align: 'center' });

    // Quiz title
    this.currentY = 70;
    this.pdf.setFontSize(18);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.text(`Quiz: ${result.categoryName}`, this.pageWidth / 2, this.currentY, { align: 'center' });

    // Score section
    this.currentY = 110;
    const scorePercentage = Math.round(result.percentage);
    
    // Score box
    this.pdf.setFillColor(40, 167, 69);
    this.pdf.roundedRect(this.pageWidth / 2 - 40, this.currentY - 10, 80, 30, 5, 5, 'F');
    
    this.pdf.setFontSize(20);
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(`${scorePercentage}%`, this.pageWidth / 2, this.currentY + 8, { align: 'center' });

    // Details
    this.currentY = 170;
    this.pdf.setFontSize(14);
    this.pdf.setTextColor(33, 37, 41);
    
    const details = [
      `Score: ${result.score} out of ${result.totalQuestions}`,
      `Time Taken: ${this.formatTime(result.timeTaken)}`,
      `Total Marks: ${result.totalMarks} out of ${result.maxMarks}`,
      `Generated: ${new Date().toLocaleString()}`
    ];

    details.forEach((detail, index) => {
      this.pdf.text(detail, this.pageWidth / 2, this.currentY + (index * 12), { align: 'center' });
    });
  }

  private addSummaryPage(result: QuizResult): void {
    this.pdf.addPage();
    this.currentY = this.margin;

    // Title
    this.pdf.setFontSize(18);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setTextColor(33, 37, 41);
    this.pdf.text('Summary', this.margin, this.currentY);
    this.currentY += 30;

    // Performance metrics
    const correct = result.correctAnswers;
    const incorrect = result.incorrectAnswers;
    const skipped = result.skippedQuestions;
    const accuracy = Math.round(result.percentage);

    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "normal");

    // Metrics grid
    const metrics = [
      ['Total Questions:', result.totalQuestions.toString()],
      ['Correct Answers:', correct.toString()],
      ['Incorrect Answers:', incorrect.toString()],
      ['Skipped Questions:', skipped.toString()],
      ['Accuracy:', `${accuracy}%`],
      ['Time Taken:', this.formatTime(result.timeTaken)],
      ['Average per Question:', this.formatTime(Math.round(result.timeTaken / result.totalQuestions))],
      ['Total Marks:', `${result.totalMarks} / ${result.maxMarks}`]
    ];

    metrics.forEach(([label, value]) => {
      this.pdf.setTextColor(108, 117, 125);
      this.pdf.text(label, this.margin, this.currentY);
      this.pdf.setTextColor(33, 37, 41);
      this.pdf.text(value, this.margin + 80, this.currentY);
      this.currentY += 15;
    });

    // Performance assessment
    this.currentY += 20;
    this.pdf.setFontSize(14);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text('Performance Assessment', this.margin, this.currentY);
    this.currentY += 20;

    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "normal");
    
    let assessment = '';
    if (accuracy >= 90) {
      assessment = 'Excellent! You have demonstrated outstanding knowledge of the subject matter.';
    } else if (accuracy >= 80) {
      assessment = 'Very Good! You have a strong understanding with room for minor improvements.';
    } else if (accuracy >= 70) {
      assessment = 'Good! You have a solid foundation but could benefit from additional review.';
    } else if (accuracy >= 60) {
      assessment = 'Fair. Consider reviewing the material and taking the quiz again to improve.';
    } else {
      assessment = 'Needs Improvement. Additional study and practice are recommended.';
    }

    const assessmentLines = this.pdf.splitTextToSize(assessment, this.pageWidth - 2 * this.margin);
    this.pdf.text(assessmentLines, this.margin, this.currentY);
  }

  private async addQuestionPage(question: QuizQuestion, detailedResult: any, questionNumber: number): Promise<void> {
    console.log(`=== ADDING QUESTION ${questionNumber} TO PDF ===`);

    // Question header
    this.pdf.setFontSize(16);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setTextColor(33, 37, 41);
    this.pdf.text(`Question ${questionNumber}`, this.margin, this.currentY);
    this.currentY += 20;

    // Question text
    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "normal");
    const questionLines = this.pdf.splitTextToSize(question.question, this.pageWidth - 2 * this.margin);
    this.pdf.text(questionLines, this.margin, this.currentY);
    this.currentY += questionLines.length * this.lineHeight + 15;

    // Add image if exists
    if (question.imageUrl) {
      console.log(`Processing image for question ${questionNumber}`);
      try {
        const imageData = await this.processImageForPDF(question.imageUrl);
        
        if (imageData) {
          console.log('Image processed successfully');
          const imageFormat = imageData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          
          // Calculate image dimensions for quiz card proportions
          const availableWidth = this.pageWidth - 2 * this.margin;
          const imageWidth = Math.min(availableWidth * 0.8, 350); // 80% of available width, max 350px
          const imageHeight = imageWidth * 0.6; // 3:2 aspect ratio
          
          // Center the image
          const imageX = (this.pageWidth - imageWidth) / 2;
          
          this.pdf.addImage(imageData, imageFormat, imageX, this.currentY, imageWidth, imageHeight);
          this.currentY += imageHeight + 20;
          console.log(`✅ Image added (${imageWidth}x${imageHeight})`);
        } else {
          console.log('❌ Failed to process image');
        }
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }

    // Answer options in 2x2 grid
    const options = [question.options.a, question.options.b, question.options.c, question.options.d];
    const correctAnswerIndex = ['a', 'b', 'c', 'd'].indexOf(question.correctAnswer);
    const userAnswerIndex = detailedResult ? ['a', 'b', 'c', 'd'].indexOf(detailedResult.userAnswer) : -1;

    this.currentY += 20;
    this.pdf.setFontSize(11); // Increased font size from 10 to 11

    // 2x2 grid layout with better proportions
    const optionWidth = (this.pageWidth - 2 * this.margin - 20) / 2; // Increased spacing
    const optionHeight = 35; // Increased height from 25 to 35
    const optionSpacing = 12; // Increased spacing from 8 to 12
    
    for (let i = 0; i < options.length; i++) {
      const isUserAnswer = userAnswerIndex === i;
      const isCorrect = i === correctAnswerIndex;
      
      // Calculate grid position
      const col = i % 2;
      const row = Math.floor(i / 2);
      const optionX = this.margin + col * (optionWidth + 20); // Increased spacing
      const optionY = this.currentY + row * (optionHeight + optionSpacing);

      // Set colors
      if (isCorrect) {
        this.pdf.setFillColor(212, 237, 218); // Light green
        this.pdf.setDrawColor(40, 167, 69);
      } else if (isUserAnswer) {
        this.pdf.setFillColor(248, 215, 218); // Light red
        this.pdf.setDrawColor(220, 53, 69);
      } else {
        this.pdf.setFillColor(248, 249, 250); // Light gray
        this.pdf.setDrawColor(206, 212, 218);
      }

      // Draw option box with better proportions
      this.pdf.roundedRect(optionX, optionY, optionWidth, optionHeight, 4, 4, 'FD');

      // Add option label with better positioning
      this.pdf.setFillColor(108, 117, 125);
      this.pdf.roundedRect(optionX + 5, optionY + 5, 18, 18, 3, 3, 'F'); // Slightly larger badge
      
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(12); // Larger font for badge
      this.pdf.text(String.fromCharCode(65 + i), optionX + 14, optionY + 17, { align: 'center' });

      // Add option text with better spacing and size
      this.pdf.setTextColor(33, 37, 41);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(11); // Consistent font size
      
      const textWidth = optionWidth - 35; // More space for text
      const wrappedText = this.pdf.splitTextToSize(options[i], textWidth);
      
      // Handle multi-line text better
      if (wrappedText.length > 2) {
        // If text is too long, show first line with ellipsis
        this.pdf.text(wrappedText[0] + '...', optionX + 28, optionY + 17);
      } else if (wrappedText.length === 2) {
        // Show two lines
        this.pdf.text(wrappedText[0], optionX + 28, optionY + 13);
        this.pdf.text(wrappedText[1], optionX + 28, optionY + 21);
      } else {
        // Single line - center it vertically
        this.pdf.text(wrappedText[0], optionX + 28, optionY + 17);
      }

      // Correct answer indicator with better positioning
      if (isCorrect) {
        this.pdf.setTextColor(40, 167, 69);
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(14); // Larger checkmark
        this.pdf.text('✓', optionX + optionWidth - 18, optionY + 17);
      }
    }

    this.currentY += 2 * (optionHeight + optionSpacing) + 20; // More spacing

    // Result indicator with better proportions
    const isAnswerCorrect = detailedResult ? detailedResult.isCorrect : false;
    this.pdf.setFontSize(13); // Slightly larger font
    this.pdf.setFont("helvetica", "bold");

    if (isAnswerCorrect) {
      this.pdf.setFillColor(212, 237, 218);
      this.pdf.setTextColor(40, 167, 69);
      this.pdf.roundedRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 25, 4, 4, 'F'); // Taller box
      this.pdf.text('✓ CORRECT', this.margin + 15, this.currentY + 16); // Better vertical centering
    } else {
      this.pdf.setFillColor(248, 215, 218);
      this.pdf.setTextColor(220, 53, 69);
      this.pdf.roundedRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 25, 4, 4, 'F'); // Taller box
      this.pdf.text('✗ INCORRECT', this.margin + 15, this.currentY + 16); // Better vertical centering
    }
  }

  private async processImageForPDF(imageUrl: string): Promise<string | null> {
    console.log('🖼️ Processing image for PDF...');

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          console.log(`✅ Image loaded: ${img.width}x${img.height}`);
          
          const canvas = document.createElement('canvas');
          
          // Ultra-high resolution for crystal clear images
          const maxWidth = 1200;  // Very high resolution
          const maxHeight = 900;
          
          let width = img.width;
          let height = img.height;
          
          // Scale only if absolutely necessary
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            if (aspectRatio > maxWidth / maxHeight) {
              width = maxWidth;
              height = maxWidth / aspectRatio;
            } else {
              height = maxHeight;
              width = maxHeight * aspectRatio;
            }
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          // Maximum quality settings
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          
          // Draw with highest quality
          ctx.drawImage(img, 0, 0, width, height);
          
          // PNG for maximum quality
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          console.log('📸 Ultra-high-res image converted');
          resolve(dataUrl);
          
        } catch (error) {
          console.error('❌ Canvas error:', error);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error('❌ Image load failed');
        resolve(null);
      };

      img.src = imageUrl;
      
      setTimeout(() => {
        if (!img.complete) {
          console.error('❌ Image load timeout');
          resolve(null);
        }
      }, 10000);
    });
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  private addFooters(): void {
    const totalPages = this.pdf.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.pdf.setPage(i);
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(108, 117, 125);
      
      // Footer line
      this.pdf.setDrawColor(220, 220, 220);
      this.pdf.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);
      
      // Footer text
      this.pdf.text('Generated by Quiz Master', this.margin, this.pageHeight - 8);
      this.pdf.text(`Page ${i} of ${totalPages}`, this.pageWidth - this.margin, this.pageHeight - 8, { align: 'right' });
      this.pdf.text(new Date().toLocaleDateString(), this.pageWidth / 2, this.pageHeight - 8, { align: 'center' });
    }
  }

  save(filename: string): void {
    this.pdf.save(filename);
    console.log(`PDF saved as: ${filename}`);
  }
}