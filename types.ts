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
}

export interface LogicDiagram {
  code: string;
  type: 'mermaid' | 'flowchart' | 'text';
}

export interface AppState {
  knowledgeLevel: KnowledgeLevel;
  mentorMode: boolean; // false = searching/guiding, true = satisfied
}