// Monitored sources for the weekly discovery crawler.
// Each source is a page the crawler fetches to find new Nepal curriculum content.

export interface MonitoredSource {
  name: string
  url: string
  description: string
}

export const MONITORED_SOURCES: MonitoredSource[] = [
  {
    name: 'NEB Education',
    url: 'https://www.nebeducation.com/',
    description: 'Nepal NEB education blog — model questions, past papers, notes for Class 9/10/SEE',
  },
  {
    name: 'School Info Nepal — SEE',
    url: 'https://www.schoolinfonepal.com/model-question/see',
    description: 'SEE model question repository organized by subject',
  },
  {
    name: 'School Info Nepal — Class 9',
    url: 'https://www.schoolinfonepal.com/model-question/class-9',
    description: 'Class 9 model question repository',
  },
  {
    name: 'Educate Nepal',
    url: 'https://www.educatenepal.com/news',
    description: 'Nepal education news and resources — past papers and model questions',
  },
  {
    name: 'Mero Notes',
    url: 'https://www.meronotes.com',
    description: 'Nepal student notes, solutions, and model questions for SEE',
  },
  {
    name: 'NEB Study',
    url: 'https://www.nebstudy.com',
    description: 'NEB board questions, notes, and study materials',
  },
]

// Nepal SEE/NEB content keywords used to filter relevance
export const CONTENT_KEYWORDS = [
  'SEE', 'NEB', 'class 9', 'class 10', 'grade 9', 'grade 10',
  'mathematics', 'science', 'english', 'nepali', 'social studies',
  'health physical education', 'HPE', 'computer science', 'ICT',
  'account', 'economics', 'optional mathematics',
  'model question', 'past paper', 'question paper', 'exam question',
  'nepal', 'CDC', 'curriculum',
]
