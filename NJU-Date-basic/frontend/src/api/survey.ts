import { api } from './client';

export type QuestionType =
  | 'likert'
  | 'single_select'
  | 'multi_select'
  | 'ranking'
  | 'open_text'
  | 'number_input'
  | 'year_range'
  | 'height_range';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  maxSelect?: number;
  min?: number;
  max?: number;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  importance?: boolean;
  required?: boolean;
  dependsOn?: {
    questionId: string;
    value: string | string[];
  };
}

export interface Section {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface SurveyQuestionsResponse {
  version: string;
  changedQuestionIds?: string[];
  sections: Section[];
}

export type AnswerValue =
  | { value: number; importance?: number }        // likert
  | { value: string }                             // single_select, open_text
  | { value: string[] }                           // multi_select, ranking
  | { value: number }                             // number_input
  | { value: { min: number; max: number } };      // year_range

export const getQuestions = () => api.get<SurveyQuestionsResponse>('/survey/questions');

export const submitAnswers = (answers: Record<string, AnswerValue>) =>
  api.post<{ message: string; surveyComplete: boolean }>('/survey/submit', { answers });

export const getAnswers = () =>
  api.get<{ answers: Record<string, AnswerValue>; version?: string; submittedAt?: string }>('/survey/answers');
