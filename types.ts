
export enum KnowledgeLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
}

export enum PaneTab {
  VISUALIZER = 'visualizer',
  TEMPLATES = 'templates',
  UPLOAD = 'upload',
  IMAGE_GEN = 'image_gen',
}

export enum TemplateCategory {
  ALL = 'All',
  CODING = 'Coding',
  ALGORITHMS = 'Algorithms',
  MATH = 'Mathematics',
  SCIENCE = 'Science',
  WRITING = 'Writing',
  SYSTEMS = 'Systems',
  DATABASE = 'Database',
  PHILOSOPHY = 'Philosophy',
  ECONOMICS = 'Economics'
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  content: string;
  category: TemplateCategory;
  isSynthesized?: boolean;
}

export interface VisualItem {
  id: string;
  type: 'mermaid' | 'image';
  content: string; // Mermaid code or Image URL
  timestamp: number;
}

export interface LogicDiagram {
  items: VisualItem[];
  title?: string;
}

export interface AppState {
  knowledgeLevel: KnowledgeLevel;
  mentorMode: boolean;
}
