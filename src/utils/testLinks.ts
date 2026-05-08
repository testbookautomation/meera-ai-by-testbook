export type TestLinkItem = {
  id?: string;
  link?: string;
  url?: string;
};

const TEST_ID_PATTERN = /\/(?:view\/)?tests\/([a-f0-9]{24})(?:[/?#]|$)/i;

export function getTestId(test: TestLinkItem): string | null {
  if (test.id) return test.id;

  const link = test.link || test.url || "";
  const match = link.match(TEST_ID_PATTERN);
  return match?.[1] || null;
}

export function getTestLinkForDevice(test: TestLinkItem, isMobile: boolean): string {
  const webLink = test.link || test.url || "https://link.testbook.com/Meera";
  const testId = getTestId(test);

  if (isMobile && testId) {
    return `testbook://tbapp/test//${testId}`;
  }

  return webLink;
}
