import type { SkillCategory } from '../types';

const skillDescriptions: Record<string, string> = {
  python: 'Build apps, automate tasks, and understand algorithms with practical Python projects.',
  typescript: 'Add structure and safety to web apps with typed JavaScript for larger codebases.',
  java: 'Learn object-oriented programming and enterprise-style application development.',
  'c++': 'Master systems-level programming and performance-focused software design.',
  'c#': 'Create Windows, web, and game applications with a modern .NET workflow.',
  go: 'Write fast, concurrent services with a simple and scalable language.',
  rust: 'Develop safe, high-performance software with memory-safe systems programming.',
  kotlin: 'Build Android apps and modern back-end services with concise, expressive code.',
  swift: 'Create polished iOS and macOS apps with Apple’s native language.',
  php: 'Build dynamic websites and server-side features for web applications.',
  sql: 'Query and manage databases with clear, efficient data operations.',
  'machine learning': 'Train models, analyze data patterns, and build intelligent applications.',
  'web development': 'Create full-stack websites from layout to deployment with modern frameworks.',
  react: 'Build interactive user interfaces with reusable components and fast updates.',
  'data science': 'Turn raw data into insight with analysis, visualization, and modeling.',
  javascript: 'Make websites interactive and bring dynamic behavior to user experiences.',
  'mobile development': 'Design and build apps for phones and tablets with responsive experiences.',
  blockchain: 'Explore decentralized systems, smart contracts, and digital trust.',
  mathematics: 'Strengthen problem-solving and analytical thinking through core math concepts.',
  physics: 'Understand motion, energy, and the laws that shape the physical world.',
  statistics: 'Learn how to interpret data, calculate uncertainty, and make decisions.',
  'data structures': 'Organize information effectively and solve problems with efficient algorithms.',
  'research methods': 'Design reliable studies and evaluate evidence with strong research practices.',
  accounting: 'Track records, budgets, and financial statements with accuracy.',
  'financial analysis': 'Interpret financial data to make better business and investment decisions.',
  'ui/ux design': 'Design intuitive product experiences that feel simple and user-friendly.',
  'graphic design': 'Create visuals, layouts, and branding that communicate clearly.',
  figma: 'Prototype interfaces and collaborate on design systems in a shared workspace.',
  photography: 'Capture compelling images by mastering light, composition, and storytelling.',
  'creative writing': 'Shape ideas into stories, articles, and expressive written work.',
  'music theory': 'Understand rhythm, harmony, and structure behind great music.',
  piano: 'Develop finger control, rhythm, and musical expression on the keyboard.',
  guitar: 'Learn chords, strumming, and technique for playing your favorite songs.',
  spanish: 'Practice speaking, listening, and reading in one of the world’s most widely spoken languages.',
  french: 'Build confidence in conversation, pronunciation, and everyday vocabulary.',
  mandarin: 'Develop listening, speaking, and character recognition skills for Mandarin.',
  'public speaking': 'Gain confidence, clarity, and presence for presentations and conversations.',
  debate: 'Sharpen reasoning, argumentation, and persuasive communication.',
  psychology: 'Explore how people think, feel, and behave in everyday life.',
};

export function getSkillDescription(skillName: string, category: SkillCategory, fallbackDescription?: string): string {
  const trimmedName = skillName.trim();
  if (trimmedName) {
    const key = trimmedName.toLowerCase();
    if (skillDescriptions[key]) {
      return skillDescriptions[key];
    }
  }

  if (fallbackDescription?.trim()) {
    return fallbackDescription;
  }

  const genericDescriptions: Record<SkillCategory, string> = {
    Academic: `Build stronger ${trimmedName || 'academic'} skills through guided practice and peer support.`,
    Technology: `Learn ${trimmedName || 'technology'} through practical projects, demos, and hands-on coaching.`,
    Creative: `Explore ${trimmedName || 'creative'} skills with inspiration, feedback, and creative collaboration.`,
    Languages: `Practice ${trimmedName || 'language'} skills in real conversations and supportive learning sessions.`,
    Business: `Develop ${trimmedName || 'business'} skills with practical advice and real-world examples.`,
    Lifestyle: `Sharpen your ${trimmedName || 'lifestyle'} skills with everyday guidance and helpful tips.`,
  };

  return genericDescriptions[category] ?? `Learn practical ${trimmedName || 'skill'} skills through peer-led sessions.`;
}
