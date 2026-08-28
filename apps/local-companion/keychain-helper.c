#include <Security/Security.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static const char *SERVICE = "com.tracy.ai-chat-hub.provider-api";

static void fail(const char *message, int code) {
  fprintf(stderr, "%s\n", message);
  exit(code);
}

static OSStatus find_password(const char *account, UInt32 *length, void **data, SecKeychainItemRef *item) {
  return SecKeychainFindGenericPassword(
    NULL,
    (UInt32)strlen(SERVICE), SERVICE,
    (UInt32)strlen(account), account,
    length, data, item
  );
}

int main(int argc, const char *argv[]) {
  if (argc != 3) fail("usage: keychain-helper <exists|get|set> <qwen|deepseek>", 2);
  const char *action = argv[1];
  const char *account = argv[2];
  if (strcmp(account, "qwen") != 0 && strcmp(account, "deepseek") != 0) fail("unsupported provider", 2);

  if (strcmp(action, "exists") == 0) {
    SecKeychainItemRef item = NULL;
    OSStatus status = find_password(account, NULL, NULL, &item);
    if (item != NULL) CFRelease(item);
    if (status == errSecItemNotFound) return 44;
    if (status != errSecSuccess) fail("keychain lookup failed", 3);
    return 0;
  }

  if (strcmp(action, "get") == 0) {
    UInt32 length = 0;
    void *data = NULL;
    SecKeychainItemRef item = NULL;
    OSStatus status = find_password(account, &length, &data, &item);
    if (status == errSecItemNotFound || length == 0) return 44;
    if (status != errSecSuccess) fail("keychain read failed", 3);
    if (fwrite(data, 1, length, stdout) != length) fail("keychain output failed", 3);
    SecKeychainItemFreeContent(NULL, data);
    if (item != NULL) CFRelease(item);
    return 0;
  }

  if (strcmp(action, "set") == 0) {
    unsigned char password[513];
    ssize_t length = read(STDIN_FILENO, password, sizeof(password));
    if (length <= 0 || length > 512) fail("invalid password", 2);

    SecKeychainItemRef item = NULL;
    OSStatus status = find_password(account, NULL, NULL, &item);
    if (status == errSecItemNotFound) {
      status = SecKeychainAddGenericPassword(
        NULL,
        (UInt32)strlen(SERVICE), SERVICE,
        (UInt32)strlen(account), account,
        (UInt32)length, password,
        NULL
      );
    } else if (status == errSecSuccess) {
      status = SecKeychainItemModifyAttributesAndData(item, NULL, (UInt32)length, password);
    }
    memset(password, 0, sizeof(password));
    if (item != NULL) CFRelease(item);
    if (status != errSecSuccess) fail("keychain write failed", 4);
    return 0;
  }

  fail("unsupported action", 2);
  return 2;
}
