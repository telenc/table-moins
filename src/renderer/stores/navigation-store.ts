import { create } from 'zustand';

export type AppRoute = 'home' | 'connections' | 'database-explorer' | 'query-editor';

interface NavigationState {
  currentRoute: AppRoute;
  setCurrentRoute: (route: AppRoute) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentRoute: 'home',
  setCurrentRoute: (route) => set({ currentRoute: route }),
}));