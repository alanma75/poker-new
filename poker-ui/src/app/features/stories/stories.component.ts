import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { switchMap, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Story } from '../../core/models';

@Component({
  selector: 'app-stories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stories.component.html',
  styleUrl: './stories.component.scss'
})
export class StoriesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  stories = signal<Story[]>([]);
  loading = signal(false);
  error = signal('');
  pendingStory = signal<Story | null>(null);
  joining = signal(false);

  form = this.fb.group({
    Name: ['', Validators.required],
    Comment: ['', Validators.required]
  });

  registrationForm = this.fb.group({
    ParticipantName: ['', Validators.required],
    IsScrumMaster: [false]
  });

  ngOnInit() {
    this.loadStories();
  }

  loadStories() {
    this.loading.set(true);
    this.api.getStories().subscribe({
      next: (data) => { this.stories.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load stories'); this.loading.set(false); }
    });
  }

  submit() {
    if (this.form.invalid) return;
    const { Name, Comment } = this.form.value;
    this.api.createStory(Name!, Comment!).subscribe({
      next: (story) => {
        this.stories.update(list => [...list, story]);
        this.form.reset();
      },
      error: () => this.error.set('Failed to create story')
    });
  }

  selectStory(story: Story) {
    this.registrationForm.reset();
    this.pendingStory.set(story);
  }

  cancelRegistration() {
    this.pendingStory.set(null);
    this.registrationForm.reset();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.pendingStory()) {
      this.cancelRegistration();
    }
  }

  confirmRegistration() {
    if (this.registrationForm.invalid || !this.pendingStory()) return;
    const story = this.pendingStory()!;
    const participantName = this.registrationForm.value.ParticipantName!;
    const isScrumMaster = !!this.registrationForm.value.IsScrumMaster;
    this.joining.set(true);
    const sessionName = `Voting: ${story.Name}`;
    this.api.getSessions().pipe(
      switchMap(sessions => {
        const existing = sessions.find(s => s.StoryId === story.id && !s.Revealed);
        return existing ? of(existing) : this.api.createSession(sessionName, story.id);
      })
    ).subscribe({
      next: (session) => {
        this.joining.set(false);
        this.pendingStory.set(null);
        this.router.navigate(['/vote', session.id], { state: { participant: participantName, isScrumMaster } });
      },
      error: () => {
        this.joining.set(false);
        this.error.set('Failed to join voting session');
      }
    });
  }
}
