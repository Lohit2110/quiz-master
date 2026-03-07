// Quick script to check for TEST 6 quiz in browser console
// Copy and paste this into your browser console at https://lohits.netlify.app

console.log('🔍 Searching for TEST 6 quiz...\n');

// Check localStorage
console.log('=== LOCAL STORAGE CHECK ===');
try {
    const savedQuizzes = JSON.parse(localStorage.getItem('quiz_master_saved_quizzes') || '[]');
    console.log(`Total quizzes in localStorage: ${savedQuizzes.length}`);
    
    const test6 = savedQuizzes.find(q => q.title && q.title.toLowerCase().includes('test 6'));
    
    if (test6) {
        console.log('✅ FOUND TEST 6 in localStorage!');
        console.log('Quiz Details:', test6);
        console.log('\n📋 To restore it, the quiz is already in your local storage.');
        console.log('Just navigate to Quiz Categories to see it.');
    } else {
        console.log('❌ TEST 6 not found in localStorage');
        console.log('Available quizzes:', savedQuizzes.map(q => q.title));
    }
} catch (error) {
    console.error('Error checking localStorage:', error);
}

console.log('\n=== FIREBASE CHECK ===');
console.log('To check Firebase, use the recovery tool or admin panel.');
console.log('The quiz might still be in Firebase even if deleted locally.');

// Instructions
console.log('\n=== RECOVERY OPTIONS ===');
console.log('1. If found in localStorage: Navigate to Quiz Categories page');
console.log('2. If not in localStorage: Use the recovery tool (recover-quiz.html)');
console.log('3. Check Firebase from Admin Panel > View all quizzes');
console.log('4. If in Firebase: Click "Sync from Cloud" button');
