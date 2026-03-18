export interface Story {
  id: string;
  Name: string;
  Comment: string;
}

export interface Vote {
  id: string;
  Participant: string;
  Points: string;
}

export interface Session {
  id: string;
  Name: string;
  StoryId: string;
  Revealed: boolean;
  Votes: Vote[];
}
