export interface TriviaQuestion {
    category: string;
    type: "multiple" | "boolean";
    difficulty: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
}

export interface TriviaApiResponse {
    response_code: number;
    results: TriviaQuestion[];
}

export interface TriviaResult {
    amount: number;
    questions: TriviaQuestion[];
}
