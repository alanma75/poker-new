import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { Session } from '../../core/models';

export const POINTS = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '∞'];

@Component({
  selector: 'app-voting',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './voting.component.html',
  styleUrl: './voting.component.scss'
})
export class VotingComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  session = signal<Session | null>(null);
  loading = signal(false);
  error = signal('');
  voted = signal(false);
  currentParticipant = signal('');
  readonly points = POINTS;

  form = this.fb.group({
    Participant: ['', Validators.required],
    Points: ['', Validators.required]
  });

  get sessionId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit() {
    const state = history.state as { participant?: string };
    if (state?.participant) {
      this.currentParticipant.set(state.participant);
      this.form.patchValue({ Participant: state.participant });
    }
    this.loadSession();
  }

  loadSession() {
    this.loading.set(true);
    this.api.getSession(this.sessionId).subscribe({
      next: (s) => { this.session.set(s); this.loading.set(false); },
      error: () => { this.error.set('Session not found'); this.loading.set(false); }
    });
  }

  selectPoint(p: string) {
    this.form.patchValue({ Points: p });
  }

  castVote() {
    if (this.form.invalid) return;
    const { Participant, Points } = this.form.value;
    this.api.castVote(this.sessionId, Participant!, Points!).subscribe({
      next: () => { this.voted.set(true); this.loadSession(); },
      error: () => this.error.set('Failed to cast vote')
    });
  }

  reveal() {
    this.api.revealVotes(this.sessionId).subscribe({
      next: (s) => this.session.set(s),
      error: () => this.error.set('Failed to reveal votes')
    });
  }

  reset() {
    this.api.resetSession(this.sessionId).subscribe({
      next: (s) => { this.session.set(s); this.voted.set(false); this.form.patchValue({ Points: '' }); },
      error: () => this.error.set('Failed to reset session')
    });
  }

  back() {
    this.router.navigate(['/']);
  }

  /** Returns true if the current participant has already cast a vote in the session. */
  hasVoted(s: Session): boolean {
    return s.Votes.some(v => v.Participant === this.currentParticipant());
  }
}
