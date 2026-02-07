import { clientRegistry } from '../../extensions/registry';
import DocumentListRenderer from './DocumentListRenderer';
import DocumentReadRenderer from './DocumentReadRenderer';
import DocumentSearchRenderer from './DocumentSearchRenderer';
import DocumentSaveRenderer from './DocumentSaveRenderer';

clientRegistry.registerTool({
  name: 'list_documents',
  description: 'Render document list results',
  resultRenderer: DocumentListRenderer,
});

clientRegistry.registerTool({
  name: 'read_document',
  description: 'Render document read results',
  resultRenderer: DocumentReadRenderer,
});

clientRegistry.registerTool({
  name: 'search_in_document',
  description: 'Render document search results',
  resultRenderer: DocumentSearchRenderer,
});

clientRegistry.registerTool({
  name: 'save_document',
  description: 'Render document save results',
  resultRenderer: DocumentSaveRenderer,
});

export {
  DocumentListRenderer,
  DocumentReadRenderer,
  DocumentSearchRenderer,
  DocumentSaveRenderer,
};
