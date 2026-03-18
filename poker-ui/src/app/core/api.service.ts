import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Session, Story, Vote } from './models';

const BASE = 'http://localhost:8000';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ── Stories ──────────────────────────────────────────────────────────────
  getStories(): Observable<Story[]> {
    return this.http.get<Story[]>(`${BASE}/userstories`);
  }

  createStory(Name: string, Comment: string): Observable<Story> {
    return this.http.post<Story>(`${BASE}/userstories`, { Name, Comment });
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  getSessions(): Observable<Session[]> {
    return this.http.get<Session[]>(`${BASE}/sessions`);
  }

  createSession(Name: string, StoryId: string): Observable<Session> {
    return this.http.post<Session>(`${BASE}/sessions`, { Name, StoryId });
  }

  getSession(id: string): Observable<Session> {
    return this.http.get<Session>(`${BASE}/sessions/${id}`);
  }

  castVote(sessionId: string, Participant: string, Points: string): Observable<Vote> {
    return this.http.post<Vote>(`${BASE}/sessions/${sessionId}/votes`, { Participant, Points });
  }

  revealVotes(sessionId: string): Observable<Session> {
    return this.http.post<Session>(`${BASE}/sessions/${sessionId}/reveal`, {});
  }

  resetSession(sessionId: string): Observable<Session> {
    return this.http.post<Session>(`${BASE}/sessions/${sessionId}/reset`, {});
  }
}
