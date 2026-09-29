export const up = async (db) => {
  const collections = await db.listCollections({ name: 'faqs' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('faqs');
  }

  const faqsCollection = db.collection('faqs');

  // Create search and order indexes
  await faqsCollection.createIndex({ isSuggested: 1, order: 1 });
  await faqsCollection.createIndex({ question: 'text', keywords: 'text' });

  // Initial FAQ Knowledge Base
  const initialFaqs = [
    {
      question: 'What is PhoneMail and how does it work?',
      answer: 'PhoneMail transforms your phone number into your email address (e.g., +14126846774@sandesh.in). It enables seamless, self-hosted webmail communication between phone identities without requiring third-party email providers.',
      category: 'general',
      isSuggested: true,
      keywords: ['what', 'phonemail', 'how', 'work', 'email', 'about', 'phone number'],
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      question: 'How do I sign up or log in to my account?',
      answer: 'You can sign up via three convenient doors: (1) Web signup using instant SMS OTP, (2) Inbound phone call via automated voice IVR, or (3) Texting SIGNUP to our phone number. After initial verification, you set a password to easily log in from the web.',
      category: 'auth',
      isSuggested: true,
      keywords: ['signup', 'register', 'login', 'signin', 'account', 'doors', 'password', 'otp'],
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      question: 'Are my emails secure and private?',
      answer: 'Yes! PhoneMail implements client-side End-to-End Encryption (E2EE) powered by TweetNaCl. Message bodies are encrypted directly in your browser before leaving your device, meaning only the intended recipient can read them.',
      category: 'security',
      isSuggested: true,
      keywords: ['secure', 'security', 'encryption', 'private', 'privacy', 'tweetnacl', 'e2e', 'safe'],
      order: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      question: 'Can I sign up via phone call or SMS?',
      answer: 'Absolutely! Dial our Telnyx phone number to hear the voice IVR setup, or send an SMS with "SIGNUP". A verified account is instantly created for your phone number, ready for you to set a password on the web.',
      category: 'auth',
      isSuggested: true,
      keywords: ['call', 'sms', 'ivr', 'text', 'voice', 'telnyx', 'phone call'],
      order: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      question: 'Can I send emails to external domains like Gmail or Yahoo?',
      answer: 'PhoneMail v1 utilizes a self-hosted, high-speed closed-loop SMTP server built for secure communication between @sandesh.in user addresses.',
      category: 'smtp',
      isSuggested: false,
      keywords: ['external', 'gmail', 'yahoo', 'smtp', 'send', 'domain'],
      order: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      question: 'What if I forget my password?',
      answer: 'You can verify your phone number via SMS OTP at any time on the login page to access your account and update your password.',
      category: 'auth',
      isSuggested: false,
      keywords: ['forgot', 'password', 'reset', 'recover', 'help'],
      order: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Upsert initial FAQs
  for (const faq of initialFaqs) {
    await faqsCollection.updateOne(
      { question: faq.question },
      { $setOnInsert: faq },
      { upsert: true }
    );
  }
};

export const down = async (db) => {
  const collections = await db.listCollections({ name: 'faqs' }).toArray();
  if (collections.length > 0) {
    await db.collection('faqs').drop();
  }
};
