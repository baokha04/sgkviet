import crypto from 'node:crypto';

const ALGORITHM = 'des-ede3-cbc';
const IV_LENGTH = 8; // 3DES IV size is 8 bytes

/**
 * Encrypts text using Triple DES (des-ede3-cbc)
 * @param text The plain text to encrypt
 * @param key The encryption key (will be padded/truncated to 24 bytes)
 * @returns Encrypted text in "iv:ciphertext" hex format
 */
export function encrypt(text: string, key: string): string {
	// Key must be 24 bytes for 3DES
	const paddedKey = Buffer.alloc(24, 0);
	paddedKey.write(key, 0, 'utf8');

	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, paddedKey, iv);
	let encrypted = cipher.update(text, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts text using Triple DES (des-ede3-cbc)
 * @param encryptedData The encrypted data in "iv:ciphertext" hex format
 * @param key The encryption key (will be padded/truncated to 24 bytes)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string, key: string): string {
	const [ivHex, encryptedText] = encryptedData.split(':');
	if (!ivHex || !encryptedText) {
		throw new Error('Invalid encrypted data format');
	}

	const paddedKey = Buffer.alloc(24, 0);
	paddedKey.write(key, 0, 'utf8');

	const iv = Buffer.from(ivHex, 'hex');
	const decipher = crypto.createDecipheriv(ALGORITHM, paddedKey, iv);
	let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}
