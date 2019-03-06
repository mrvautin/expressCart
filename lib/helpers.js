var helpers = {};

helpers.PASSWORD_STRENGTH = {
  STRONG: 'strong',
  MEDIUM: 'medium',
  WEAK: 'weak',
};

helpers.ACCEPTABLE_PASSWORD_STRENGTH = [
  helpers.PASSWORD_STRENGTH.STRONG,
  helpers.PASSWORD_STRENGTH.MEDIUM,
];

helpers.passwordStrength = (password)=>{
  password = typeof password == 'string' ? password : '';

  var strongPasswordRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
  var mediumPasswordRegex = new RegExp("^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})");

  if(password.test(strongPasswordRegex)) return PASSWORD_STRENGTH.STRONG;
  if(password.test(mediumPasswordRegex)) return PASSWORD_STRENGTH.MEDIUM;

  return PASSWORD_STRENGTH.WEAK;
};

module.exports = helpers;
