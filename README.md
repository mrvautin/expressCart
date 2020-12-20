
![expressCart](https://raw.githubusercontent.com/mrvautin/expressCart/master/public/images/logo.png)

`expressCart`  is a fully functional shopping cart built in Node.js (Express, MongoDB) with Stripe, PayPal and Authorize.net payments.

[**View the demo**](https://demo.expresscart.markmoffat.com/)

[**Admin demo**](https://demo.expresscart.markmoffat.com/admin/)

## Requirements
* [**Node.js 7.0+**](https://nodejs.org/en/download/)
* [**MongoDB 2.6+**](https://www.mongodb.com/1)

## Start mongodb server

```shell
$ mongod --dbpath "/path/to/my/database/"
```
```
Demo credentials

Admin User:
- User: `demo@test.com`
- Password: `test`

Customer:
- User: `test@test.com`
- Password: `test`

Discount code:
- 10 amount: `DEMO_AMT10`
- 10 percent: `DEMO_PCT10`

```


## Installation

> Make sure all the requirements are installed already.

1.  Create a folder to hold your installation:  `mkdir expressCart`
2.  FTP/Copy the contents of the zip to your newly created folder
3.  Enter folder:  `cd expressCart`
4.  Install dependencies:  `npm install`
5.  Start application:  `npm start --production`
6.  Visit  [http://127.0.0.1:1111](http://127.0.0.1:1111/)  in your browser

Keeping expressCart running after closing the terminal can be done in a few ways but we recommend using the  `PM2`  package. To set this up:

1.  Install PM2:  `npm install pm2 -g`
2.  Add expressCart to PM2:  `NODE_ENV=production pm2 start app.js --name "expressCart"`
3.  Check PM2 has our app:  `pm2 list`
4.  Save the PM2 config:  `pm2 save`
5.  To start/stop:  `pm2 start expressCart`  /  `pm2 stop expressCart`

> Note: Node.js version 7.x or greater is needed.
> Make Sure MongoDB is runnning.

### Docker

The easiest way to get up and running is using Docker. Once the Docker CLI is installed from  [https://www.docker.com/get-docker](https://www.docker.com/get-docker).

1.  Enter the root of the expressCart application
2.  Change  `/config/settings.json`  -  `"databaseConnectionString": "mongodb://mongodb:27017/expresscart"`
3.  Run:  `docker-compose up --build`
4.  Visit  [http://127.0.0.1:1111](http://127.0.0.1:1111/)  in your browser
5. Optional. To install test data run the following 
- `docker exec -it expresscart bash`
- `npm run testdata`
- `exit`

### Deploy on Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/mrvautin/expressCart)

> Note: When deploying to Heroku you will need to configure your external MongoDB either on your own server or a hosted service on mLab, AWS etc.

## Admin

Visit:  [http://127.0.0.1:1111/admin](http://127.0.0.1:1111/admin)

A new user form will be shown where a user can be created.

### Styling

Adding your own custom style is done by accessing the  `Admin`  panel then selecting  `General settings`.

#### Demo images

Sample homepage  ![Sample homepage](https://mrvautin.com/content/images/2018/01/expressCart-demo.jpg)

Admin page  ![Admin page](https://mrvautin.com/content/images/2018/01/admin-settings.png)

Popout cart  ![Popout cart](https://mrvautin.com/content/images/2018/02/popout-cart.png)

Great themes  ![Great themes](https://mrvautin.com/content/images/2018/02/expresscart-mono-theme.png)

##### CSS

You can add your own custom CSS into the  `Custom CSS`  box. This will be minified and added to each page.

##### Footer

You can add your own custom HTML footer which may have contact details, social media links etc into the  `Footer HTML`  box. This will be added to bottom of each page.

### Products

Adding of new products is done via  `/admin/product/new`.

##### Product price

Set this value to a full 2 decimal value with no commas or currency symbols.

##### Permalink

A permalink is a nice link to your product which is normally shown in search engine rankings. By default, a no Permalink value is set when adding a product one will be generated using the Product title with spaces replaced by dashes.

##### Options

You may want to set product options such as  `Size`,  `Color`  etc.

Below is an explanation of the fields and what they do

`Name`  = Something easy to recognize to administer  `Label`  = This will be shown to the customer (eg:  `Select size`,  `Select color`  etc)  `Type`  = You can set the option to a  `Select`  (drop down menu),  `Radio`  (An optional button) or a  `Checkbox`  for an on/off or true/false option  `Options`  = Available options are added using a comma separated list. For size options you may set:  `Small,Medium,Large`  or  `S,M,L`

Note: An  `Options`  value is not required when  `Type`  is set to  `Checkbox`.

##### Product tag words

Tags are used when indexing the products for search. It's advised to set tags (keywords) so that customers can easily find the products they are searching for.

## Database

`expressCart`  uses a MongoDB for storing all the data. Setting of the database connection string is done through the  `/config/settings.json`  file. There are two properties relating to the database connection:

Example MongoDB configuration:

```
{
    "databaseConnectionString": "mongodb://localhost:27017/expresscart"
}

```

Note: The  `databaseConnectionString`  property requires a full connection string. You may need to add authentication parameters to your connection string.

> For a good and reasonably priced MongoDB Host, we recommend  [mLab](https://mlab.com/).

## Configuration

All settings can be made in the config file and some settings can also be managed from the admin panel ([http://127.0.0.1:1111/admin](http://127.0.0.1:1111/admin)).

Settings are stored in JSON files in the `/config` directory. The main application-level settings are stored in `/config/settings.json` while payment gateway settings are stored in files in the `/config` directory named after the payment gateway. For example, configuration for the Stripe payment gateway is stored in `/config/payment/config/stripe.json`.

Configs are validated against the schema files. For the `settings.json` this will be validated against the `settingsSchema.json` file. The Payment gateway config is validated against the `/config/payment/schema/<gateway>.json` file.

##### Environment configuration

Environment configuration can be achieved using an `env.yaml` file (in the root of the app) to override any settings. You may want to do something like:

``` yaml
development:
  port: 1111
  databaseConnectionString: mongodb://127.0.0.1:27017/expresscart
production:
  port: 2222
  databaseConnectionString: mongodb://prod_db_url:27017/expresscart
```

The app will read in the `NODE_ENV` and switch and override any valid settings. Eg: `databaseConnectionString` set in the `env.yaml` file will override anything in `settings.json` file.

This can also be used for payment modules too. Any settings in the `env.yaml` file will override the `/config/payment/config/<gateway>.json` file.

### Configuration
Property | Description
--- | ---
cartTitle | This element is critical for search engine optimisation. Cart title is also displayed if your logo is hidden.
cartDescription | This description shows when your website is listed in search engine results.
cartLogo | URL to the logo for your cart
baseUrl | This URL is used in sitemaps and when your customer returns from completing their payment etc.
emailHost | The host address of your email provider
emailPort | The post of your email provider
emailSecure | The secure true/false indicator
emailUser | The email user. Normally the email address.
emailPassword | The password of your email provider
emailAddress | This is used as the `from` email when sending receipts to your customers.
productsPerRow | The number of products to be displayed across the page.
productsPerPage | The number of products to be displayed on each page.
footerHtml | Any HTML you want to be displayed in the footer of each page
googleAnalytics | Your Google Analytics code. Also include the `<script>` tags - [More info](https://support.google.com/analytics/answer/1032385?hl=en)
injectJs | Javascript code you want to inject onto pages. You may use this for Chatbots etc.
customCss | Custom CSS which will override the base CSS
currencySymbol | Set this to your currency symbol. Eg: $, £, €
currencyISO | Set this to your currency ISO code. Eg: USD, AUD, EUR, GBP etc
paymentGateway | An array of Payment Gateways or providers to be used. 
databaseConnectionString | The MongoDB database connection string
theme | The name of the Theme to be used
trackStock | Whether your cart will track stock levels
orderHook | On the completion of a order, expressCart will POST the data to the configured URL
availableLanguages | Language to use. Eg: `en` or `it`
defaultLocale | The default language/locale to fall back to for translations
maxQuantity | The maximum quantity of any product which can be added to the cart.
twitterHandle | The Twitter @ handle used in SEO
facebookAppId | The Facebook App ID used in SEO
productOrderBy | The field in which the products are ordered by. Eg: Product title etc
productOrder | The sort order of products. Eg: `ascending` or `descending`
modules | The modules configured and enabled. Check `settings.json` for example.
showRelatedProducts | Shows related products when viewing a product for cross selling
showHomepageVariants | Whether to show the product variants (eg: size etc) in a dropdown on the homepage when displaying products.



## Payments
`expressCart` has the ability to combine multiple payment methods at checkout. For instance, you may want to provide credit card payments using [Stripe](https://stripe.com/) but also add Bitcoin with [Blockonomics](https://www.blockonomics.co/), [PayPal](http://paypal.com/) and Buy Now Pay later with [Zip](https://zip.co/).

Payment providers included:
- [Stripe](https://stripe.com/)
- [PayPal](http://paypal.com/)
- [Blockonomics](https://www.blockonomics.co/)
- [Authorize.net](https://www.authorize.net/)
- [Adyen](https://www.adyen.com/)
- [PayWay](https://www.payway.com.au/)
- [Zip](https://zip.co/)
- Instore

#### Paypal (Payments)

The Paypal config file is located: `/config/payment/config/paypal.json`. A example Paypal settings file is provided:

```
{
    "description": "Paypal payment",
    "mode": "live", // sandbox or live
    "client_id": "this_is_not_real",
    "client_secret": "this_is_not_real",
    "paypalCartDescription": "expressCart", // Shows as the Paypal description
    "paypalCurrency": "USD" // The Paypal currency to charge in
}
```
Note: The `client_id` and `client_secret` is obtained from your Paypal account.

#### Stripe (Payments)

The Stripe config file is located: `/config/payment/config/stripe.json`. A example Stripe settings file is provided:

```
{
    "description": "Card payment",
    "secretKey": "sk_test_this_is_not_real",
    "publicKey": "pk_test_this_is_not_real",
    "stripeCurrency": "usd", The Stripe currency to charge in
    "stripeDescription": "expressCart payment", // Shows as the Stripe description
    "stripeLogoURL": "http://localhost:1111/images/stripelogo.png" // URL to the logo to display on Stripe form
    "stripeWebhookSecret": "whsec_this_is_not_real"
}
```

Note: The `secretKey`, `publicKey` and `stripeWebhookSecret` is obtained from your Stripe account dashboard.

#### Blockonomics (Bitcoin Payments)

You have to configure the `HTTP Callback URL` parameter into Blockonomics -> Merchants -> Settings:
http://CartURL/blockonomics/checkout_return where [**CartURL**](#cart-url) is the address of your server

The Blockonomics config file is located: `/config/payment/config/blockonomics.json`. A example Blockonomics settings file is provided:

```
{
    "description": "Blockonomics payment",
    "apiKey": "this_is_not_real",
    "hostUrl": "https://www.blockonomics.co", // You usually don't need to change this
    "newAddressApi": "/api/new_address", // You usually don't need to change this
    "priceApi": "/api/price?currency=" // You usually don't need to change this
}
```
Note: The `apiKey` is obtained from your Blockonomics account.

#### Authorize.net (Payments)

The Authorize.net config file is located: `/config/payment/config/authorizenet.json`. A example Authorize.net settings file is provided:

```
{
    "description": "Card payment",
    "loginId": "loginId",
    "transactionKey": "transactionKey",
    "clientKey": "clientKey",
    "mode": "test"
}
```

Note: The credentials are obtained from your Authorize.net account dashboard.

#### Adyen (Payments)

The Adyen config file is located: `/config/payment/config/adyen.json`. A example Adyen settings file is provided:

```
{
    "description": "Card payment",
    "environment": "TEST",
    "apiKey": "this_is_not_real",
    "originKey": "this_is_not_real",
    "merchantAccount": "this_is_not_real",
    "statementDescriptor": "a_statement_descriptor",
    "currency": "AUD"
}
```

Note: The `publicKey`, `apiKey` and `merchantAccount` is obtained from your Adyen account dashboard.

#### Westpac PayWay (Payments)

The PayWay config file is located: `/config/payment/config/payway.json`. A example PayWay settings file is provided:

```
{
    "description": "Card payment",
    "apiKey": "TXXXXX_SEC_btbqXxXxqgtzXk2p27hapvxXXXXxw28gh3febtuaf2etnkXxXxehdqu98u",
    "publishableApiKey": "T11266_PUB_btbq8r6sqgtz5k2p27hapvx8nurxw28gh3fepbtua2f2etnkp4bmehdqu98u",
    "merchantId": "TEST"
}
```

Note: The `apiKey`, `publishableApiKey` and `merchantId` is obtained from your PayWay account dashboard.

#### Zip (Payments)

The Zip config file is located: `/config/payment/config/zip.json`. A example Zip settings file is provided:

```
{
    "description": "Pay with Zip",
    "privateKey": "KqtU4WtVeXAAbksD1dPpufYXgtfFe0hL9OhBF7hLXzQ=",
    "mode": "test",
    "currency": "AUD",
    "supportedCountries": [
        "Australia",
        "New Zealand"
    ]
}
```

Note: The `privateKey` is obtained from your account dashboard.

#### Instore (Payments)

The Instore config file is located: `/config/payment/config/instore.json`. A example Instore settings file is provided:

```
{
    "description": "Instore payment",
    "orderStatus": "Pending",
    "buttonText": "Place order, pay instore",
    "resultMessage": "The order is place. Please pay for your order instore on pickup."
}
```
Note: No payment is actually processed. The order will move to the `orderStatus` set and the payment is completed instore.

## Email settings

You will need to configure your SMTP details for expressCart to send email receipts to your customers.

You will need to consult your email provider for the relevant details.

##### Gmail settings

-   `Email SMTP Host`  = smtp.gmail.com
-   `Email SMTP Port`  = 465
-   `Email SMTP secure`  = True/Checked
-   `Email SMTP Username`  = example@gmail.com
-   `Email SMTP Password`  = yourpassword (you may need to setup an application specific password for this to work)

##### Zoho settings

-   `Email SMTP Host`  = smtp.zoho.com
-   `Email SMTP Port`  = 465
-   `Email SMTP secure`  = True/Checked
-   `Email SMTP Username`  = example@zoho.com
-   `Email SMTP Password`  = yourpassword

##### Outlook settings

-   `Email SMTP Host`  = smtp-mail.outlook.com
-   `Email SMTP Port`  = 587
-   `Email SMTP secure`  = False/Unchecked
-   `Email SMTP Username`  = example@outlook.com
-   `Email SMTP Password`  = yourpassword

You can use the  `Send test email`  button to ensure your email settings are correct.

## Menu

Although  `expressCart`  is a search based shopping cart, you can also group your products into categories using tags. You can then setup menu Items to "filter" based on keywords (tags) to make it easier for your customers.

Setting of menu items is done via  `/admin/settings/menu`.

To add a new menu item to filter products, you will set the menu text using the  `Menu`  field and setting the keyword to filter is using the  `link`  field.

To add a new menu item to link to a static page, you will set the menu text using the  `Menu`  field and set the static page URL using the  `link`  field. Eg: An  `About`  page would be set. Menu = 'About Us', Link = 'about`

You can re-order menu items by clicking and dragging the arrows icon and placing the menu item in desired position.

## Static pages

You may want to create a static page to show contact details, about us, shipping information etc.

New static pages are setup via  `/admin/settings/pages`.

## Discount codes

You may want to create discount codes to be given to customers for promotions etc. 

New discount codes are setup via `/admin/settings/discounts`.

***

## Google data

By default the product data is updated into a Google feed format here: `/googleproducts.xml`. 

You can setup Google to read this data [here](https://merchants.google.com/)

1. Products > Feeds > (+)
2. Set the Country and language
3. Set A name and `Scheduled fetch`
4. Set the url to `https://mydomain.com/googleproducts.xml` 
5. Complete

## Modules
It's possible to extend the basic functionality of `expressCart` using modules. All modules are loaded from `/lib/modules` folder at startup and added to the `config` for use throughout the app. There is an example module `shipping-basic` to calculate the flat shipping rate. One way to extend this basic module is to call a Postage service like [easypost](https://www.easypost.com/) to get an accurate rate for your location, package size etc.

``` json
"modules": {
    "enabled": {
        "shipping": "shipping-basic",
            "discount": "discount-voucher",
            "reviews": "reviews-basic"
         },
    "loaded": {
        "shipping": {},
        "discount": {},
        "reviews": {}
    }
}
```

## TODO

-   Add some tests...
-   Separate API and frontend
-   Modernize the frontend

## Contributing

I'm looking for contributors of any kind. I'm working on turning the admin panel into something more modern and using Vue.js. The frontend part of the website will always be a normal webapp with no SPA frameworks as I believe eCommerce apps should have SEO as top priority.

Contributing payment providers and themes would be much appreciated. Payment providers are added by simply adding the payment provider file to  `/routes/payments/providerName.js`, then adding the route to the  `app.js`  file by adding  `const providerName = require('./routes/payments/{providerName}');`  and mounting the route  `app.use('/providerName', providerName);`.

If you see current code which could be enhanced (note: parts of the code is quite old but new to Github) you are welcome to submit a PR.