import EmailTemplate from '../models/EmailTemplate.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export const INITIAL_EMAIL_TEMPLATES = [
  {
    title: 'Sick Leave Request',
    category: 'workplace',
    subject: 'Sick Leave Notification - [Your Name] - [Date]',
    body: `Dear [Manager/Supervisor Name],

I am writing to inform you that I am unwell today due to [brief illness/fever] and will not be able to attend work on [Date(s)].

I plan to consult a doctor and will keep you updated regarding my recovery and expected return date. For any urgent questions during my absence, please reach out via phone or this email.

Thank you for your understanding.

Best regards,
[Your Name]`,
    tags: ['sick', 'leave', 'absence', 'health', 'hr', 'medical'],
    isSystem: true,
    usageCount: 42,
  },
  {
    title: 'Planned Vacation / Leave Request',
    category: 'workplace',
    subject: 'Leave Application: [Your Name] - [Start Date] to [End Date]',
    body: `Hi [Manager Name],

I would like to request [Number] days of planned leave from [Start Date] to [End Date] to attend to personal commitments.

Ahead of my time off, I will ensure all current deliverables are up to date and hand over pending responsibilities to [Colleague Name]. I will have limited access to email but can be contacted via phone for emergencies.

Kindly approve my leave request.

Warm regards,
[Your Name]`,
    tags: ['vacation', 'holiday', 'pto', 'annual leave', 'leave'],
    isSystem: true,
    usageCount: 38,
  },
  {
    title: 'Work From Home (WFH) Notice',
    category: 'workplace',
    subject: 'Work From Home Request - [Your Name] - [Date]',
    body: `Hi [Manager Name],

I am requesting permission to work remotely from home on [Date/Period] due to [reason, e.g., home repairs/mild indisposition].

I will be fully available during regular working hours across all communication channels and will attend all scheduled meetings as usual.

Thanks for your consideration,
[Your Name]`,
    tags: ['wfh', 'remote', 'work from home', 'telecommute'],
    isSystem: true,
    usageCount: 35,
  },
  {
    title: 'Meeting Invitation / Schedule Request',
    category: 'meeting',
    subject: 'Meeting Request: Discussion on [Topic/Project Name]',
    body: `Hi [Name],

I hope you're having a productive week.

I would love to set up a brief [15/30-minute] meeting with you to discuss [Topic/Objective]. Would any of the following time slots work for you?

• [Option 1: Date & Time]
• [Option 2: Date & Time]
• [Option 3: Date & Time]

If none of these suit your calendar, please feel free to propose an alternate time that works best for you.

Looking forward to speaking,
[Your Name]`,
    tags: ['meeting', 'schedule', 'invitation', 'call', 'calendar'],
    isSystem: true,
    usageCount: 50,
  },
  {
    title: 'Meeting Minutes & Action Items',
    category: 'meeting',
    subject: 'Recap & Action Items: [Meeting Title] - [Date]',
    body: `Hi Team,

Thank you all for your time today during our discussion on [Topic]. Here is a quick summary of the key takeaways and agreed next steps:

Key Takeaways:
• [Key point 1]
• [Key point 2]

Action Items:
• [Action 1] - Assigned to [Owner] (Due: [Date])
• [Action 2] - Assigned to [Owner] (Due: [Date])

Please let me know if I missed anything or if any adjustments are needed.

Best regards,
[Your Name]`,
    tags: ['minutes', 'recap', 'summary', 'action items', 'meeting'],
    isSystem: true,
    usageCount: 29,
  },
  {
    title: 'Gentle Follow-Up on Pending Response',
    category: 'followup',
    subject: 'Following up on: [Original Subject / Topic]',
    body: `Hi [Name],

I hope this email finds you well.

I wanted to gently bump this email to check if you had a chance to review my previous message regarding [Topic/Project].

Please let me know if you need any additional details or clarification from my side to help move this forward.

Thanks,
[Your Name]`,
    tags: ['followup', 'bump', 'gentle', 'reminder', 'pending'],
    isSystem: true,
    usageCount: 65,
  },
  {
    title: 'Weekly Project Status Update',
    category: 'business',
    subject: 'Weekly Status Update: [Project Name] - [Week of Date]',
    body: `Hi [Stakeholder/Manager Name],

Here is our weekly progress update for [Project Name]:

✅ Key Accomplishments This Week:
• [Completed Milestone 1]
• [Completed Milestone 2]

🚀 In Progress & Next Steps:
• [Current priority 1]
• [Current priority 2]

⚠️ Blockers & Risks:
• [None / specify any blocker]

Please let me know if you have any questions or require further details.

Best regards,
[Your Name]`,
    tags: ['status', 'update', 'weekly', 'report', 'project'],
    isSystem: true,
    usageCount: 40,
  },
  {
    title: 'Cold Outreach / Partnership Pitch',
    category: 'business',
    subject: 'Exploring collaboration between [Your Company] & [Their Company]',
    body: `Hi [Name],

I noticed the impressive work your team is doing with [Specific Initiative or Area] and wanted to reach out.

At [Your Company], we specialize in [Brief 1-sentence value proposition or solution]. We recently helped [Similar client or peer] achieve [specific outcome/metric].

Do you have 10 minutes next week for a brief introductory chat to see if there is mutual value in partnering?

Best regards,
[Your Name]
[Your Title]`,
    tags: ['sales', 'outreach', 'pitch', 'partnership', 'cold email'],
    isSystem: true,
    usageCount: 30,
  },
  {
    title: 'Thank You & Sincere Appreciation',
    category: 'personal',
    subject: 'Thank You - Appreciating your help with [Topic/Project]',
    body: `Dear [Name],

I wanted to take a moment to express my sincere gratitude for your assistance with [Topic/Task/Project].

Your support, expertise, and prompt guidance made a tremendous difference, and I genuinely appreciate the time you took out of your schedule to help.

Looking forward to working together again soon.

Warm regards,
[Your Name]`,
    tags: ['thank you', 'appreciation', 'gratitude', 'support'],
    isSystem: true,
    usageCount: 33,
  },
  {
    title: 'Formal Resignation Notice',
    category: 'workplace',
    subject: 'Formal Resignation - [Your Name]',
    body: `Dear [Manager Name],

Please accept this letter as formal notification that I am resigning from my position as [Your Role] at [Company Name]. My last day of employment will be [Date], in accordance with my notice period.

I am deeply grateful for the opportunities I have had during my time with the team. I intend to make the transition as smooth as possible by wrapping up my responsibilities and assisting with any handover.

I wish you and the company continued success.

Sincerely,
[Your Name]`,
    tags: ['resignation', 'notice', 'farewell', 'hr', 'departure'],
    isSystem: true,
    usageCount: 15,
  },
  {
    title: 'Invoice / Payment Overdue Reminder',
    category: 'urgent',
    subject: 'Reminder: Invoice #[Invoice Number] Due on [Date]',
    body: `Hi [Client/Finance Name],

I hope everything is going well.

This is a reminder that Invoice #[Invoice Number] for [Amount], issued on [Invoice Date], is due for payment on [Due Date].

Attached is a copy of the invoice for your reference. Could you please confirm if this is scheduled for processing?

If you have any questions regarding the invoice, please feel free to reach out.

Best regards,
[Your Name]`,
    tags: ['invoice', 'payment', 'due', 'billing', 'reminder', 'finance'],
    isSystem: true,
    usageCount: 25,
  },
  {
    title: 'Incident / Service Outage Apology & Update',
    category: 'urgent',
    subject: 'Notice: [Issue/Outage Name] Resolution & Next Steps',
    body: `Dear [Customer/Client Name],

We are writing to provide an update regarding the recent issue with [Service/Feature] that occurred on [Date/Time].

Our engineering team identified the root cause as [brief explanation] and deployed a permanent fix at [Time]. The system is now operating normally and all operations have been verified.

We sincerely apologize for any inconvenience this may have caused to your workflow. We are taking additional preventive measures to ensure this does not recur.

Thank you for your patience and understanding.

Sincerely,
[Your Name/Team Name]`,
    tags: ['incident', 'outage', 'apology', 'support', 'resolution'],
    isSystem: true,
    usageCount: 20,
  },
];

/**
 * Seeds initial predefined templates if the collection is empty.
 */
export async function seedEmailTemplates() {
  try {
    const count = await EmailTemplate.countDocuments({ isSystem: true });
    if (count === 0) {
      await EmailTemplate.insertMany(INITIAL_EMAIL_TEMPLATES);
      logger.info(`Seeded ${INITIAL_EMAIL_TEMPLATES.length} initial predefined email templates successfully.`);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to seed initial email templates');
  }
}
