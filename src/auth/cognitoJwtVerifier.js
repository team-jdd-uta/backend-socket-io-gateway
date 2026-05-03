const { createRemoteJWKSet, jwtVerify } = require('jose');
const config = require('../config');

function resolveIssuer() {
  if (config.cognito.issuerUri) {
    return config.cognito.issuerUri;
  }
  if (!config.cognito.userPoolId) {
    return '';
  }
  return `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.userPoolId}`;
}

function createCognitoJwtVerifier() {
  const issuer = resolveIssuer();
  if (!issuer) {
    return {
      async verify() {
        throw new Error('cognito issuer is not configured');
      },
    };
  }
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return {
    async verify(token) {
      const options = { issuer };
      if (config.cognito.clientId) {
        options.audience = config.cognito.clientId;
      }
      const { payload } = await jwtVerify(token, jwks, options);
      const tokenUse = String(payload.token_use || '');
      if (tokenUse && tokenUse !== 'access' && tokenUse !== 'id') {
        throw new Error('invalid token_use');
      }
      return {
        cognitoSub: String(payload.sub || ''),
        userId: String(payload['custom:user_id'] || payload.username || payload['cognito:username'] || payload.email || payload.sub || ''),
        username: String(payload['cognito:username'] || payload.username || payload.email || payload.sub || ''),
        email: String(payload.email || ''),
      };
    },
  };
}

module.exports = { createCognitoJwtVerifier };
