import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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

  form = this.fb.group({
    Name: ['', Validators.required],
    Comment: ['', Validators.required]
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
    const sessionName = `Voting: ${story.Name}`;
    this.api.createSession(sessionName, story.id).subscribe({
      next: (session) => this.router.navigate(['/vote', session.id]),
      error: () => this.error.set('Failed to create voting session')
    });
  }
}
