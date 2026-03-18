import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/stories/stories.component').then(m => m.StoriesComponent)
  },
  {
    path: 'vote/:id',
    loadComponent: () =>
      import('./features/voting/voting.component').then(m => m.VotingComponent)
  },
  { path: '**', redirectTo: '' }
];
