// Client extension system for @chaaskit/client
export {
  clientRegistry,
  type PageExtension,
  type ToolExtension,
  type ComponentOverride,
} from './registry';

export {
  useExtensionPages,
  useSidebarPages,
  useExtensionTools,
  useToolRenderer,
  useComponentOverride,
} from './useExtensions';
