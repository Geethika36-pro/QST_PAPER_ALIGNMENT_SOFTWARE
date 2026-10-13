/**
 * Main Application Orchestrator
 * Question Paper Alignment Software
 */

import { store } from './state.js';
import { ApiService } from './api.js';
import { ToolbarComponent } from './components/toolbar.js';
import { HeaderFormComponent } from './components/headerForm.js';
import { SectionListComponent } from './components/sectionList.js';
import { QuestionFormComponent } from './components/questionForm.js';
import { PreviewPaneComponent } from './components/previewPane.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Mount Toolbar
  const toolbarContainer = document.getElementById('app-header');
  if (toolbarContainer) {
    new ToolbarComponent(toolbarContainer);
  }

  // Mount Header Form (Paper details)
  const headerFormContainer = document.getElementById('header-form-container');
  if (headerFormContainer) {
    new HeaderFormComponent(headerFormContainer);
  }

  // Mount Section & Question List
  const sectionListContainer = document.getElementById('section-list-container');
  if (sectionListContainer) {
    new SectionListComponent(sectionListContainer);
  }

  // Mount Question Modal Form
  new QuestionFormComponent();

  // Mount Preview Pane
  const previewContainer = document.getElementById('preview-pane-container');
  if (previewContainer) {
    new PreviewPaneComponent(previewContainer);
  }

  // Mobile View Tabs Toggle
  setupMobileTabs();

  // Background Health Check
  const health = await ApiService.checkHealth();
  store.backendStatus = health.isOnline ? 'online' : 'offline';
  store.notify('backend_status_change');
});

function setupMobileTabs() {
  const tabEditor = document.getElementById('tab-btn-editor');
  const tabPreview = document.getElementById('tab-btn-preview');
  const paneEditor = document.querySelector('.pane-editor');
  const panePreview = document.querySelector('.pane-preview');

  if (!tabEditor || !tabPreview || !paneEditor || !panePreview) return;

  tabEditor.addEventListener('click', () => {
    tabEditor.classList.add('active');
    tabPreview.classList.remove('active');
    paneEditor.classList.remove('mobile-hidden');
    panePreview.classList.add('mobile-hidden');
  });

  tabPreview.addEventListener('click', () => {
    tabPreview.classList.add('active');
    tabEditor.classList.remove('active');
    panePreview.classList.remove('mobile-hidden');
    paneEditor.classList.add('mobile-hidden');
  });
}
