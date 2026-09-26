window.nanakiPrivatePayload = {
      initiator: ((function(){
  const exports = {};
  const cryptoEngine = ((function(){
  const exports = {};
  const { subtle } = crypto;

const IV_BITS = 16 * 8;
const HEX_BITS = 4;
const ENCRYPTION_ALGO = "AES-CBC";

/**
 * Translates between utf8 encoded hexadecimal strings
 * and Uint8Array bytes.
 */
const HexEncoder = {
    /**
     * hex string -> bytes
     * @param {string} hexString
     * @returns {Uint8Array}
     */
    parse: function (hexString) {
        if (hexString.length % 2 !== 0) throw "Invalid hexString";
        const arrayBuffer = new Uint8Array(hexString.length / 2);

        for (let i = 0; i < hexString.length; i += 2) {
            const byteValue = parseInt(hexString.substring(i, i + 2), 16);
            if (isNaN(byteValue)) {
                throw "Invalid hexString";
            }
            arrayBuffer[i / 2] = byteValue;
        }
        return arrayBuffer;
    },

    /**
     * bytes -> hex string
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    stringify: function (bytes) {
        const hexBytes = [];

        for (let i = 0; i < bytes.length; ++i) {
            let byteString = bytes[i].toString(16);
            if (byteString.length < 2) {
                byteString = "0" + byteString;
            }
            hexBytes.push(byteString);
        }
        return hexBytes.join("");
    },
};

/**
 * Translates between utf8 strings and Uint8Array bytes.
 */
const UTF8Encoder = {
    parse: function (str) {
        return new TextEncoder().encode(str);
    },

    stringify: function (bytes) {
        return new TextDecoder().decode(bytes);
    },
};

/**
 * Salt and encrypt a msg with a password.
 */
async function encrypt(msg, hashedPassword) {
    // Must be 16 bytes, unpredictable, and preferably cryptographically random. However, it need not be secret.
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#parameters
    const iv = crypto.getRandomValues(new Uint8Array(IV_BITS / 8));

    const key = await subtle.importKey("raw", HexEncoder.parse(hashedPassword), ENCRYPTION_ALGO, false, ["encrypt"]);

    const encrypted = await subtle.encrypt(
        {
            name: ENCRYPTION_ALGO,
            iv: iv,
        },
        key,
        UTF8Encoder.parse(msg)
    );

    // iv will be 32 hex characters, we prepend it to the ciphertext for use in decryption
    return HexEncoder.stringify(iv) + HexEncoder.stringify(new Uint8Array(encrypted));
}
exports.encrypt = encrypt;

/**
 * Decrypt a salted msg using a password.
 *
 * @param {string} encryptedMsg
 * @param {string} hashedPassword
 * @returns {Promise<string>}
 */
async function decrypt(encryptedMsg, hashedPassword) {
    const ivLength = IV_BITS / HEX_BITS;
    const iv = HexEncoder.parse(encryptedMsg.substring(0, ivLength));
    const encrypted = encryptedMsg.substring(ivLength);

    const key = await subtle.importKey("raw", HexEncoder.parse(hashedPassword), ENCRYPTION_ALGO, false, ["decrypt"]);

    const outBuffer = await subtle.decrypt(
        {
            name: ENCRYPTION_ALGO,
            iv: iv,
        },
        key,
        HexEncoder.parse(encrypted)
    );

    return UTF8Encoder.stringify(new Uint8Array(outBuffer));
}
exports.decrypt = decrypt;

/**
 * Salt and hash the password so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>}
 */
async function hashPassword(password, salt) {
    // we hash the password in multiple steps, each adding more iterations. This is because we used to allow less
    // iterations, so for backward compatibility reasons, we need to support going from that to more iterations.
    let hashedPassword = await hashLegacyRound(password, salt);

    hashedPassword = await hashSecondRound(hashedPassword, salt);

    return hashThirdRound(hashedPassword, salt);
}
exports.hashPassword = hashPassword;

/**
 * This hashes the password with 1k iterations. This is a low number, we need this function to support backwards
 * compatibility.
 *
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>}
 */
function hashLegacyRound(password, salt) {
    return pbkdf2(password, salt, 1000, "SHA-1");
}
exports.hashLegacyRound = hashLegacyRound;

/**
 * Add a second round of iterations. This is because we used to use 1k, so for backwards compatibility with
 * remember-me/autodecrypt links, we need to support going from that to more iterations.
 *
 * @param hashedPassword
 * @param salt
 * @returns {Promise<string>}
 */
function hashSecondRound(hashedPassword, salt) {
    return pbkdf2(hashedPassword, salt, 14000, "SHA-256");
}
exports.hashSecondRound = hashSecondRound;

/**
 * Add a third round of iterations to bring total number to 600k. This is because we used to use 1k, then 15k, so for
 * backwards compatibility with remember-me/autodecrypt links, we need to support going from that to more iterations.
 *
 * @param hashedPassword
 * @param salt
 * @returns {Promise<string>}
 */
function hashThirdRound(hashedPassword, salt) {
    return pbkdf2(hashedPassword, salt, 585000, "SHA-256");
}
exports.hashThirdRound = hashThirdRound;

/**
 * Salt and hash the password so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {string} password
 * @param {string} salt
 * @param {int} iterations
 * @param {string} hashAlgorithm
 * @returns {Promise<string>}
 */
async function pbkdf2(password, salt, iterations, hashAlgorithm) {
    const key = await subtle.importKey("raw", UTF8Encoder.parse(password), "PBKDF2", false, ["deriveBits"]);

    const keyBytes = await subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: hashAlgorithm,
            iterations,
            salt: UTF8Encoder.parse(salt),
        },
        key,
        256
    );

    return HexEncoder.stringify(new Uint8Array(keyBytes));
}

function generateRandomSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(128 / 8));

    return HexEncoder.stringify(new Uint8Array(bytes));
}
exports.generateRandomSalt = generateRandomSalt;

async function signMessage(hashedPassword, message) {
    const key = await subtle.importKey(
        "raw",
        HexEncoder.parse(hashedPassword),
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign"]
    );
    const signature = await subtle.sign("HMAC", key, UTF8Encoder.parse(message));

    return HexEncoder.stringify(new Uint8Array(signature));
}
exports.signMessage = signMessage;

function getRandomAlphanum() {
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let byteArray;
    let parsedInt;

    // Keep generating new random bytes until we get a value that falls
    // within a range that can be evenly divided by possibleCharacters.length
    do {
        byteArray = crypto.getRandomValues(new Uint8Array(1));
        // extract the lowest byte to get an int from 0 to 255 (probably unnecessary, since we're only generating 1 byte)
        parsedInt = byteArray[0] & 0xff;
    } while (parsedInt >= 256 - (256 % possibleCharacters.length));

    // Take the modulo of the parsed integer to get a random number between 0 and totalLength - 1
    const randomIndex = parsedInt % possibleCharacters.length;

    return possibleCharacters[randomIndex];
}

/**
 * Generate a random string of a given length.
 *
 * @param {int} length
 * @returns {string}
 */
function generateRandomString(length) {
    let randomString = "";

    for (let i = 0; i < length; i++) {
        randomString += getRandomAlphanum();
    }

    return randomString;
}
exports.generateRandomString = generateRandomString;

  return exports;
})());
const codec = ((function(){
  const exports = {};
  /**
 * Initialize the codec with the provided cryptoEngine - this return functions to encode and decode messages.
 *
 * @param cryptoEngine - the engine to use for encryption / decryption
 */
function init(cryptoEngine) {
    const exports = {};

    /**
     * Top-level function for encoding a message.
     * Includes password hashing, encryption, and signing.
     *
     * @param {string} msg
     * @param {string} password
     * @param {string} salt
     *
     * @returns {string} The encoded text
     */
    async function encode(msg, password, salt) {
        const hashedPassword = await cryptoEngine.hashPassword(password, salt);

        const encrypted = await cryptoEngine.encrypt(msg, hashedPassword);

        // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
        // it in localStorage safely, we don't use the clear text password)
        const hmac = await cryptoEngine.signMessage(hashedPassword, encrypted);

        return hmac + encrypted;
    }
    exports.encode = encode;

    /**
     * Encode using a password that has already been hashed. This is useful to encode multiple messages in a row, that way
     * we don't need to hash the password multiple times.
     *
     * @param {string} msg
     * @param {string} hashedPassword
     *
     * @returns {string} The encoded text
     */
    async function encodeWithHashedPassword(msg, hashedPassword) {
        const encrypted = await cryptoEngine.encrypt(msg, hashedPassword);

        // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
        // it in localStorage safely, we don't use the clear text password)
        const hmac = await cryptoEngine.signMessage(hashedPassword, encrypted);

        return hmac + encrypted;
    }
    exports.encodeWithHashedPassword = encodeWithHashedPassword;

    /**
     * Top-level function for decoding a message.
     * Includes signature check and decryption.
     *
     * @param {string} signedMsg
     * @param {string} hashedPassword
     * @param {string} salt
     * @param {int} backwardCompatibleAttempt
     * @param {string} originalPassword
     *
     * @returns {Object} {success: true, decoded: string} | {success: false, message: string}
     */
    async function decode(signedMsg, hashedPassword, salt, backwardCompatibleAttempt = 0, originalPassword = "") {
        const encryptedHMAC = signedMsg.substring(0, 64);
        const encryptedMsg = signedMsg.substring(64);
        const decryptedHMAC = await cryptoEngine.signMessage(hashedPassword, encryptedMsg);

        if (decryptedHMAC !== encryptedHMAC) {
            // we have been raising the number of iterations in the hashing algorithm multiple times, so to support the old
            // remember-me/autodecrypt links we need to try bringing the old hashes up to speed.
            originalPassword = originalPassword || hashedPassword;
            if (backwardCompatibleAttempt === 0) {
                const updatedHashedPassword = await cryptoEngine.hashThirdRound(originalPassword, salt);

                return decode(signedMsg, updatedHashedPassword, salt, backwardCompatibleAttempt + 1, originalPassword);
            }
            if (backwardCompatibleAttempt === 1) {
                let updatedHashedPassword = await cryptoEngine.hashSecondRound(originalPassword, salt);
                updatedHashedPassword = await cryptoEngine.hashThirdRound(updatedHashedPassword, salt);

                return decode(signedMsg, updatedHashedPassword, salt, backwardCompatibleAttempt + 1, originalPassword);
            }

            return { success: false, message: "Signature mismatch" };
        }

        return {
            success: true,
            decoded: await cryptoEngine.decrypt(encryptedMsg, hashedPassword),
        };
    }
    exports.decode = decode;

    return exports;
}
exports.init = init;

  return exports;
})());
const decode = codec.init(cryptoEngine).decode;

/**
 * Initialize the staticrypt module, that exposes functions callbable by the password_template.
 *
 * @param {{
 *  staticryptEncryptedMsgUniqueVariableName: string,
 *  isRememberEnabled: boolean,
 *  rememberDurationInDays: number,
 *  staticryptSaltUniqueVariableName: string,
 * }} staticryptConfig - object of data that is stored on the password_template at encryption time.
 *
 * @param {{
 *  rememberExpirationKey: string,
 *  rememberPassphraseKey: string,
 *  replaceHtmlCallback: function,
 *  clearLocalStorageCallback: function,
 * }} templateConfig - object of data that can be configured by a custom password_template.
 */
function init(staticryptConfig, templateConfig) {
    const exports = {};

    /**
     * Decrypt our encrypted page, replace the whole HTML.
     *
     * @param {string} hashedPassword
     * @returns {Promise<boolean>}
     */
    async function decryptAndReplaceHtml(hashedPassword) {
        const { staticryptEncryptedMsgUniqueVariableName, staticryptSaltUniqueVariableName } = staticryptConfig;
        const { replaceHtmlCallback } = templateConfig;

        const result = await decode(
            staticryptEncryptedMsgUniqueVariableName,
            hashedPassword,
            staticryptSaltUniqueVariableName
        );
        if (!result.success) {
            return false;
        }
        const plainHTML = result.decoded;

        // if the user configured a callback call it, otherwise just replace the whole HTML
        if (typeof replaceHtmlCallback === "function") {
            replaceHtmlCallback(plainHTML);
        } else {
            document.write(plainHTML);
            document.close();
        }

        return true;
    }

    /**
     * Attempt to decrypt the page and replace the whole HTML.
     *
     * @param {string} password
     * @param {boolean} isRememberChecked
     *
     * @returns {Promise<{isSuccessful: boolean, hashedPassword?: string}>} - we return an object, so that if we want to
     *   expose more information in the future we can do it without breaking the password_template
     */
    async function handleDecryptionOfPage(password, isRememberChecked) {
        const { staticryptSaltUniqueVariableName } = staticryptConfig;

        // decrypt and replace the whole page
        const hashedPassword = await cryptoEngine.hashPassword(password, staticryptSaltUniqueVariableName);
        return handleDecryptionOfPageFromHash(hashedPassword, isRememberChecked);
    }
    exports.handleDecryptionOfPage = handleDecryptionOfPage;

    async function handleDecryptionOfPageFromHash(hashedPassword, isRememberChecked) {
        const { isRememberEnabled, rememberDurationInDays } = staticryptConfig;
        const { rememberExpirationKey, rememberPassphraseKey } = templateConfig;

        const isDecryptionSuccessful = await decryptAndReplaceHtml(hashedPassword);

        if (!isDecryptionSuccessful) {
            return {
                isSuccessful: false,
                hashedPassword,
            };
        }

        // remember the hashedPassword and set its expiration if necessary
        if (isRememberEnabled && isRememberChecked) {
            window.localStorage.setItem(rememberPassphraseKey, hashedPassword);

            // set the expiration if the duration isn't 0 (meaning no expiration)
            if (rememberDurationInDays > 0) {
                window.localStorage.setItem(
                    rememberExpirationKey,
                    (new Date().getTime() + rememberDurationInDays * 24 * 60 * 60 * 1000).toString()
                );
            }
        }

        return {
            isSuccessful: true,
            hashedPassword,
        };
    }
    exports.handleDecryptionOfPageFromHash = handleDecryptionOfPageFromHash;

    /**
     * Clear localstorage from staticrypt related values
     */
    function clearLocalStorage() {
        const { clearLocalStorageCallback, rememberExpirationKey, rememberPassphraseKey } = templateConfig;

        if (typeof clearLocalStorageCallback === "function") {
            clearLocalStorageCallback();
        } else {
            localStorage.removeItem(rememberPassphraseKey);
            localStorage.removeItem(rememberExpirationKey);
        }
    }

    async function handleDecryptOnLoad() {
        let isSuccessful = await decryptOnLoadFromUrl();

        if (!isSuccessful) {
            isSuccessful = await decryptOnLoadFromRememberMe();
        }

        return { isSuccessful };
    }
    exports.handleDecryptOnLoad = handleDecryptOnLoad;

    /**
     * Clear storage if we are logging out
     *
     * @returns {boolean} - whether we logged out
     */
    function logoutIfNeeded() {
        const logoutKey = "staticrypt_logout";

        // handle logout through query param
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.has(logoutKey)) {
            clearLocalStorage();
            return true;
        }

        // handle logout through URL fragment
        const hash = window.location.hash.substring(1);
        if (hash.includes(logoutKey)) {
            clearLocalStorage();
            return true;
        }

        return false;
    }

    /**
     * To be called on load: check if we want to try to decrypt and replace the HTML with the decrypted content, and
     * try to do it if needed.
     *
     * @returns {Promise<boolean>} true if we derypted and replaced the whole page, false otherwise
     */
    async function decryptOnLoadFromRememberMe() {
        const { rememberDurationInDays } = staticryptConfig;
        const { rememberExpirationKey, rememberPassphraseKey } = templateConfig;

        // if we are login out, terminate
        if (logoutIfNeeded()) {
            return false;
        }

        // if there is expiration configured, check if we're not beyond the expiration
        if (rememberDurationInDays && rememberDurationInDays > 0) {
            const expiration = localStorage.getItem(rememberExpirationKey),
                isExpired = expiration && new Date().getTime() > parseInt(expiration);

            if (isExpired) {
                clearLocalStorage();
                return false;
            }
        }

        const hashedPassword = localStorage.getItem(rememberPassphraseKey);

        if (hashedPassword) {
            // try to decrypt
            const isDecryptionSuccessful = await decryptAndReplaceHtml(hashedPassword);

            // if the decryption is unsuccessful the password might be wrong - silently clear the saved data and let
            // the user fill the password form again
            if (!isDecryptionSuccessful) {
                clearLocalStorage();
                return false;
            }

            return true;
        }

        return false;
    }

    async function decryptOnLoadFromUrl() {
        const passwordKey = "staticrypt_pwd";
        const rememberMeKey = "remember_me";

        // try to get the password from the query param (for backward compatibility - we now want to avoid this method,
        // since it sends the hashed password to the server which isn't needed)
        const queryParams = new URLSearchParams(window.location.search);
        const hashedPasswordQuery = queryParams.get(passwordKey);
        const rememberMeQuery = queryParams.get(rememberMeKey);

        const urlFragment = window.location.hash.substring(1);
        // get the password from the url fragment
        const hashedPasswordRegexMatch = urlFragment.match(new RegExp(passwordKey + "=([^&]*)"));
        const hashedPasswordFragment = hashedPasswordRegexMatch ? hashedPasswordRegexMatch[1] : null;
        const rememberMeFragment = urlFragment.includes(rememberMeKey);

        const hashedPassword = hashedPasswordFragment || hashedPasswordQuery;
        const rememberMe = rememberMeFragment || rememberMeQuery;

        if (hashedPassword) {
            return handleDecryptionOfPageFromHash(hashedPassword, rememberMe);
        }

        return false;
    }

    return exports;
}
exports.init = init;

  return exports;
})()),
      config: {"staticryptEncryptedMsgUniqueVariableName":"573c89913cc26ec2d8214bd0bfef046acce3a48ae7a0fa4cdbf625712df62113ba1c7436a0a6a243f8f89a48dba3fc36761154502a795193afabe28eba45904ad99c689f0ce222f666c642e16669d2602873f9db6ca205d0d719e79dbd343bfb86bf68a449c986da9525924fe31e9baae6c65d24de028ef34bfa75d968aa1100dde119c2f41ac38738ffe725abf176e12201c3b285de50c73ddc517e8a5258781e44fa5587987eca236638284e54629b891911cf177dc23eae6cf95c87cdbc587e3fe5604d81e421621a8bd8b69540e86e2943c8913ef7de10b59fac9c8a9a58dfbb2aa5cb7aa8af0ba3c0e8d0a6e8adac62c1fe08520ce5d85cd8c4b0b975ae8442265760c1862ae8e3d1fb2cb92486f002624a37829e25fadfd12a1832691d1c12e62d64156d8ce4889bc203267abfb534c2dce37bff2af7f4bd2df390372b20f00b1af9f3ca25d63f390d513852991e0d3e37d9d9f3a4f02276c459b5fa218291b1bccc0b73284bf33bb072f75046b11e41365706aefd812d97fdb7811d67907ea596f79e3ef166164043b652a1350c7efc1a30c40968dbd1d54e630459074b3ad9069ef4b58bb5180935e46d9929804e63c457f3f250aa7dd694d095c0653318c423cdfc00e414ed4a08e8f5bb311cedee7d846b1471a80ac44b8ad4f793fee7c4682f6aa134114f95fb30c446b194bc64a1c90e93168add5c3b295593bc01b6bb094ea6c1fdfaa0dc49cda74f4cb3e582a1005719b077be8bddb0e5b516bd55109f0f09607d900c9cd2cf9a13f8d54031bf78066c91eef326339bfce2529bfedebfcecf5ac9b17d9b4b72bd27ae7ef0117db472c66d211d1f1534f0cbd9966ffbf5dbf72aac7e5f4479444ec02180742a13d686b83e70eda301b78b5c4370ba71318febd08905653d80e0b6a3484374114a13f67ac4fcb2e9a79dc58bfc33dd4b41ead8dcf04b3f362a1e3f87d2bb7366bba7834a44c2ede79ec228c314fb1be3e6e98548e660aede166a510516f126582247f1e2ce13afae43bc1b5393fe08fd9085f35264e14c14129ed94ae9aa291e2a4718c94384ac71c078a9a28f081faa51ab631a1d14dd51e0627fc9284f2a2974777a27daeee070e96b7dfb55037e9d06fd5af190a80b94da276a55e9e5a5b9912e0a6e4bb8247b7ae5063fd67e397ba4dd8ab101e584c9b41df3f117affa2e2156bd5ee279daad24c44e3817ab473eece565932304e6fc6eb2ee4ce4bc370522ca6bfe5ccdb4919700dec9e1bc2d7df586cf392aa456a0785ec720241204d84193c95d98e7c405e125ccd6d859478da069bbfabb16f76a2fc344f76db73fd7d676649cfde0b2ea2778472101a25c3f4e0f964027add8417fb1c8de7dab8484886c149838e8710fa20aaf1b166c2b6d6a58a741ca5b4f9d9dfc6f687f7b8268edd557d433875fd2d99a41c082f18ced2f4dca412344acfa1118670696ba6acd6748b6b7741c18dcb60ccf4a20144911cedbe3afead213b32d6cf585a2f41a3029a8054de27bede6ba7ac94c6cae7da2cfd7930405b854d38c117472b8c162d6f98f723617d7a4272ed9b7bdff6e60ef314c8df2d292d55c57f42a7882265c540d71842623a59ce6f4f00813bf596ff96a38c2264dfc4e7d84ee38b17ca69ced1e561d472e1a70733847dfef5719c0a544ab8af19d5700a357d2e315e1ce1f82b816414fb97aedfca3552f38e330d7ca37d9e58b03cc4d17f4b51651ada94cf44da4239ce07c597602dadf84035cbdfd7f82c7ed0bc1df1ef3df0f1d4a4dc78ee145ac27ebdb7c20a338bad62ed214fcd908281b70396fab381470c80a194894df537c8f03196949e0c3abec350f72c3b8a77b0fbe732fa8a3e731516fc34c6a3cb828d189d3039592453bef6868ec258c2ded7a57d13e1cbe210007f2f274f5fd9cde8e43881ac25f9305ea3f8bfe73ac8af36f03a2383e64d3b1994fa4700f2a2d2786692d5d124bc01739c0d057a3ae2deb6bbdd8d819f03531c8c0746d0f759f6ca62793e7d9dc6ed8c2c99f78cae1d2cdb035330b796d221a10ccfcba7962d1ddc96e2fa52e60dbd6e499be56e1be836df06bfd9ecf5e46da5e9188bfe0d2d3d2639bbd01d0714d3d468674369c65d71e7a103c7248fff2070dec33d9a6cb5cc28f33f0df9a24d64f429e4a9ab3a52bc4e5b12da445a1f134ad7cda4db9e813fd5f741f5163dbfec3c7a65ba593ee3b8fc7db08f6077c634e26f2c5d653b86efeb4efcc624c86116832ff37316554f2e446cd664ab0e93a062c172ae10817d5702143a64b6047c8bfc8980afb5b96b7dcb02ec4c54d047d22f257ce75cffcd71ea1fc4f0ac67a2080a8f77e45de1f706201ebd494db9e2852644cb9c9ad0eee6ffe372d8452c88da4e567638f4b1f545a10f8f0bb51ad8253eaf00a5286b8a3f0509cb5a3c238c1d36e28a02066cde62b124c5694743aad4bfeec1395fbcab9649bd882100605c492a4e578b14debb7eee90b8879c76c84f1544df22bf3408be4323a82feaef66752d6ccfe8b38adcd4b13315e578c31469ea9d03f238e03be38682e4bb76d40fa719f90db74aad2103dcdc5cbcdc2d684ee1521c75b219110490ad112d8e577482fef0bbb5db50865c75ddd5f3b06a19297d2174d0fa34ceb217dc32ca58a0d79c5d49adbf33cc3f33bdf93d1592e7fb51b6b31ddeb402d483f92e9874e0031ed788591dd8ae85e93375344e9a6926829ddf23ad399bc3a9fc5f542611fdedacf0f8bcc68085428cb27ae668fbc322e40eba8fa7d9627827b932f7c48ecdb57de8edb91c316bc5676f371dc52605dc520f3e68e93560127d61135668ca5afd495fa2f9cd1f892b2102a1da17e1c9b578350ad9fd6466a6a96ca0a0771110613dca4d5be61c92abc9324394776fae4a72fcf35e28e9e2cd2924edd7f3a68833efab9bed32a16a5bbc65b02f700314ef2a4bda77f56e038cd10b30243a099d06afbec079ea3194e7cf2b0c4c173a3fa80d11922a2e3fdb3704bea45d14094c25ac345455ba39d5c5b16af30568ad86dc99a8ffdf21e7498f850b95fde24d0b62e15afa4149b01b3cf79ff07a5d1e785b64abcc20bbe9c3642ffd3eb59fcf8304ed97c6b16646900bc52cb46f488f09b3b39ecc6246867e6160b9f43c92ff6ae0ddad31109cbb9217a254fa7e1f407fe215f3f6164483e3beead46ca7eaa96efe884b0e21f67967e950d5f106db1bbf4037c08855b159752e15e26fc4d41f2172eac8a9f217149d316fb8f9fd59e3ab06b3dd7bd89bf3cbdf6b4a80a8ef7751ef729c14b9b307d2db98678f7f074db4d7ae6c145fed60415d5fd5c115eaaca1370b088dd525f1813dbd1d87124ce129453eb3da723d1831a0932bf41736cc2860b76e9fb6a72d2744819d7c4a3d52ed1c6b3c5f88bfb1ebbdbf0e0534a536d555417bac10d71db5a91687b905b4d21074e593914cef5e1210ca8c26ce00c4d3ace40829c486776121fe88f415d7b12605e7e0826209a40aa6166b1c47597ebb743797f61c7adc0bb3efa1d0fc6f1b692be13d3a64987f1ff1e354342b167cabd96d91273cb0dbc208f68941cc11c23d4112ec717320937987b73c30bb2f3af3feb376fffad0a8c261275f57113c6f18302a716fe8caa0507ff4af7df8ad03f609c293a0695c83d99abb30a50597b69c212fe598201b1fb784f2fadf8e79038fb2fd58a1b1c03a69b4561490ca069601d04aea00e1628a4280f6ca31eb4c42cd18952356881e757c5c842ea444345e815e073dc2e6cd80798c983f92652751991213e6ba8f2bd6aeb85496463334902c222f1552238d374e1623f63db9334ab3a8ca77f88bf7157f5770630774072ca60897474e90bd1aaa9f76438d5e54dd12e541d7416294fda702fffbf5e4ffca858e5f4c0cb957ffed80b43d4c292bac4229da3f16268a0b24d0cacb54a8a169a2ae63a5d534e1f4936524228d34a8d2e54f68742468c06413c6f032fc5b683167c23fac5c2962a861635505d8792df822bb398a4e71bfe9e41cc3410f8f4f2505d104becc087dc7fe7f7a210633dddf1b91982f06ee03d01a842c8d994c07ea12f8fcc3220bb1f9c015366cba769314d393ec6f3733f80653b8c4dc850bce72239cdbed656b0d82ab83cf8d7f6a4c511bf904542d1ab5fe0736128ee2cead430c499e0f9e81d020c43ae0ab7c69f7b1c2c3d4652a2d443aa2dd0c0e1b04a284c4cd4265848e4057db35cd784c02c56e850a1847157cdc39246bc1bba65c3ab9f452d9e050041fa728d8e5ad3af001c24379d790185a51197f84861e69ebb03147b27d6f0ac25761648dfc2503ab55e6c38f4f45e959161e0f8ec77ade1913b18c346561db6f1b2b2f9cbb69336210f4999c8845e312a51b54cb087c354375a7dd7adf5c6f413c34f98d01cc1834d64ec2fca8d1b90888c718e8c06d955cef7ac50bc7608f762caaec242f2724ad9869c1701e6e5a3c5386c7ce92d58f86f35e5c36b510965a6b1a5d7a55f7c7280925cb17e1c278e923fae02213cc0dd600608eff39a5ca1a6b9f5c474391f11ccd8e569351ade755ca5124390807e232980516534be747f2de9c853ebae2c633ca8711abc739f157b09dfdf98c4ecd0ebbd154fecc325cba547cb76c22c8eabd6d1843f9c861cfcca81de5c755e5732663f787c57964b4a52a3cbe4eae6da8bc029e71d644c40cb863ecd51029bba9e4bb89e683c0d8dcef090e5c193c7cfea0b35c6e667cd3e53123c643bfaf8bd000d2b33cda90353387736aaf438616b85760a4e9b1545bab80125361abd9f0221c0bb1b839dfefe0d111dbf617f0858fbf8e95fd139704e46d64286de22cd0c551584d39befc7854751ec47d2d98986e6ca4699cbc2ea62325451106c4176604e8ee1056528ff2612cfa1c587828b8fcb5ce96866df4de4c3fde31d6cc374d60bc0a97aaba5d944a10eec4a6549112e2969195cee13379dee540175d6fea0b382eb470553113624c87cc9968c1b7f4a86a68345049b93e2ee6d4105642fb7fb0bf63d1d0631fff72ae1ec4821c707d13b4743f18be10a1602f2d246903603718a74d11b1882b1191b8669c6cd712c56ff8ffb12bf9bf3b76489e701831053f9996f09ffe6b72fe05450ab44a72e9c831746fabd9f14b78e5aed1794f4819c2151fac7849eedf74df1f197b21b9b2836997983fceab484c0c2768197eae509b6aee9e409555fa0ad5b4ae9fd236e495d1b9d8fb51ccaaf87b698056a13f9e78604778b4dcc14728c38d9af58a4bec3c50a102541e60d543822eff4d5cc47bd2b53e37390833fba1664f663a8ffcab0a44598ed3595572710709e8ebb2d55c18653e693bfe8f4f71ec7cae7eababd0befbdedbdd694f09dba8ee159c078c54679a886bdf0480e3b32d016681833e5b7a442284540e40397e75468dec733bcfee9821c9816cbb8ca3e5df5da158f9754eca1a49a7f053d0a0ba06275921a0f435fa2a0415c2f1d3c8199f578d1df36f1af7e8b8eef24f6131d8a940220dde93c982af58e7e22c4939fb16f7f6fdc316ac3e3f2577067f92c1ea68cbb3df3833f8e5b0210ba2bbf78840d19acd68a028eb438120561d47186597ad3cf7d23cc882db42b288d2146806f16bc3bf08f552f22a04ee829fd68e14b91d3174903956e10477ebbb74859c1ac7466d443604749292db7be2fb50b8581b228c41c16269f68c63c3810dbfbd01ddb1264a434259949e01ac56de3b27d7b00c1e8487aa07de3d6c29bea72366a96f320b53d1471605a61400c2650728d0d511d3d1f9f593e4747f1267a1ba63e4bb7d4fc12b7e01c0a32971b886ddd35f91472240512edf2c2b6968de2ada34941b3204d1c158d10d739521f23236480da4f7098b0c45f4bd141011e9bfe36a3c93afd572463264a1f2f211a201402b4f04422c77b175db8ea7053ab0a38457bc3774e1dbccc10966f7769e742d68500ab0acb48ea8c01f637cfbe30bbc44c9128274502f53522b85bfe9deb00f6ffa50902462f477777d109a7525d875bd12811e8f3a0b3923f1824a90930c1d426cf77b8a6872af99be69331e51bdbb0598a776cbb79599f6b23aa2710621ac30987d20a6dabf96498983b512896287d3b605b6aaa1b2fc98894296f503b63d03fcd5641f4794f8deaa623f6a36f9b771f62c599a3b26b332f9d11c67ff82dd7ad3437801e0233126c500ac7f82087ea5606be71cf417d64e83f404517f55509512c73b937c14e545cc240ea69a10489b93ffd710b9ba1f10f407714ca072e99cbca8eb9789ee42af319edca807a645e3b67b9cb2d3330856895856e41432c16c1b5cc2537de5350d701d29c6329d5ddf1a345fafa34cd5e1bc9dcb4673b6a07143102b46bcaf847983386081b67a5d547118377c84e000b7bf8452d36d19dccb666c0538032bebebc044e009ea3ea6022d3ca387f01a84e1233ca5513c8985b9df7011190cdebfa8db163efebf6bbc7f1c89b9d4a6c635479c02a98d84a60f47e6e5ff7b34c5344502569f07fb618c8567874b7b5b3a6d61112d7e032aa172cac95db2b96c311979de8ef48c44660a7583ba12652341ca756b2132b4cdb7afdd5fbe38da59643aab8ccbfe8a644954eff5510cd494d20d27e09f30881d8ab20d9a80ac798519f75d06c71cfe6f0974ddafd09dc217ba1f95d1d7cf6323a17b83b8f156df994f8a11b3bd769c7c409c2315ecae78549c5af27677cb63d7c67a7ba43982e745233938c61d3dec5eabe35479515cc07eeccb944666ec2eb80c524651ec132d000239f56f0228876bd2ecce331c99895e3cf0c9c3ea931aa29a07d3a007323ca2b367a7af9810a8ccef04644505e6858f71ef01d7f0c40f441c9cb4c951564a800a0b3cb28b8cfb5b66f587adc3615113dd953adf14f6a40b528486952a8de0e3067dad3668c46fe34d5de8d594c914ed1c82d99542547f06aa15b1c20442164d1dfd092ab85ed1cba0eccb19e4b6925f791a527aa8f933261105ec543290915a875f1184008073a3cec459ab70dc8120db8107d5ba99ab96e8351c63189002a8f52cc05d2622260a74623c9279a8398f1417b98a0f0ee685e3ede34c2dce4c77db623714198f4a6128bc6647bc488301931a7468a2da8d988d0a1df278180d900fef20dca43918632b2b64acaf7b09aac43574288d5d4885d54ee68c6ed08b9131938a28ff2de53d07176b72909d8e92d54e96f16964f8705a2477d0e4b09bf47922c1e4bb743ec879c3bfa509c83eb560d5b42fe6ec12a23240a94ae3e3640a7f65262eeab1ee4ab5356dbf26fc607f01da99624db88c8a7a70b10642ea1b94bf80e07aeb19310d3b012cfcb17481c76d525f99263d732b4170f8219041fdbc897b99ae710addefea4cf9303eebaf19c7fa7854bee5b50706dc2b2ed4d7e7411a14831671638ad6f9e440f0d3640e9ddd2086d143488108204e3b2b42b0668b3aa8e4664b0e065b3656ef95e9e6effb0ac1335576ca1dfe3e06cd0fbb2ae98bb9969785dcb01491041260ee6124be7eb58662827519c33b34f26b886d9a8c23a0f502fcd323e3bd9322e0204ae95b4624badc4338aed002ab9bb0935023dd70cb86deb34536d579cdf0955e4e02690860e69dc3516675e40030be87d37555a6b28635f52a7163c6cb58dea35fb66ef24511903ee468c4c1c23ccd8ff5bdfd12c4ab30a112a88cec6836f9ee97a782b","isRememberEnabled":false,"rememberDurationInDays":0,"staticryptSaltUniqueVariableName":"3e4ec3c20e4394358cf5cd2c5ccc5342"},
    };
