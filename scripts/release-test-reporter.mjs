// Machine-readable Node test events, including registration evidence per file.
// The parent gate decides success; a child exit code alone accepts skips.
export default async function* releaseReporter(source) {
  for await (const event of source) {
    if (['test:pass', 'test:fail', 'test:summary'].includes(event.type)) {
      yield `RELEASE_TEST_EVENT ${JSON.stringify(event)}\n`;
    } else if (event.type === 'test:stderr') {
      yield event.data.message;
    }
  }
}
