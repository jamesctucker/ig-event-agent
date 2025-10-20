# Contributing to Instagram Event Agent

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js 18+
- Chrome browser
- API keys (OpenAI, Google Sheets)

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The extension will be built to build/chrome-mv3-dev/
```

### Loading in Chrome

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` directory

## Code Style

### TypeScript

- Use strict mode
- Provide type annotations
- Avoid `any` types
- Use interfaces for objects

Example:

```typescript
interface Event {
  title?: string
  date?: string
  time?: string
}

function processEvent(event: Event): void {
  // Implementation
}
```

### Vue Components

- Use Composition API with `<script setup>`
- Define props with TypeScript
- Use SCSS for styling

Example:

```vue
<script setup lang="ts">
interface Props {
  title: string
}

const props = defineProps<Props>()
</script>
```

### SCSS

- Use BEM-like naming
- Nest selectors logically
- Use variables for colors

Example:

```scss
.event-card {
  &__title {
    font-size: 16px;
  }

  &:hover {
    transform: translateY(-2px);
  }
}
```

## Project Structure

```
ig_event_agent/
├── popup.vue              # Main popup UI
├── options.vue            # Settings page
├── background/            # Service worker
│   ├── index.ts
│   └── messages/          # Message handlers
├── contents/              # Content scripts
├── lib/                   # Utility libraries
└── components/            # Reusable Vue components
```

## Making Changes

### Adding a New Feature

1. **Plan**: Document what you want to build
2. **Branch**: Create a feature branch
3. **Code**: Implement with tests
4. **Test**: Verify it works
5. **Document**: Update relevant docs
6. **Submit**: Create a pull request

### Fixing a Bug

1. **Reproduce**: Confirm the bug exists
2. **Isolate**: Find the root cause
3. **Fix**: Make minimal changes
4. **Test**: Verify the fix works
5. **Document**: Add to CHANGELOG
6. **Submit**: Create a pull request

## Testing

### Manual Testing

See [TESTING.md](./TESTING.md) for detailed testing procedures.

Quick test checklist:

- [ ] Extension loads without errors
- [ ] Collections are detected
- [ ] Events are extracted correctly
- [ ] Google Sheets export works
- [ ] Error handling works

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No console errors
- [ ] Tested in Chrome

## Pull Request Process

1. **Title**: Clear, descriptive title
2. **Description**: What and why
3. **Testing**: How you tested
4. **Screenshots**: If UI changes
5. **Breaking Changes**: Clearly noted

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing

How did you test these changes?

## Screenshots

If applicable, add screenshots

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add image batch processing
fix: correct date parsing for informal dates
docs: update setup guide with OAuth steps
style: format code with prettier
refactor: extract AI logic into separate module
test: add tests for date utilities
```

Format: `type: description`

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

## Code Review

All submissions require review. We look for:

1. **Correctness**: Does it work?
2. **Quality**: Is it well-written?
3. **Testing**: Is it tested?
4. **Documentation**: Is it documented?
5. **Style**: Does it follow guidelines?

## Areas for Contribution

### High Priority

- Improved Instagram scraping (handle structure changes)
- Better error handling and retry logic
- Performance optimizations
- Accessibility improvements

### Features

- Multiple sheet support
- Calendar export (iCal)
- Duplicate detection
- Custom AI prompts
- Batch collection processing

### Documentation

- Video tutorials
- More examples
- Troubleshooting guide
- API cost calculator

### Testing

- Unit tests for utilities
- E2E tests with Puppeteer
- Performance benchmarks

## Questions?

- Check existing documentation
- Search existing issues
- Ask in discussions
- Open a new issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

Thank you for contributing! 🎉
