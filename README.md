
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# GlueHome Homebridge Plugin

This is a template Homebridge platform plugin and can be used as a base to help you get started developing your own plugin.

## Installation

Install `@gluehome/homebridge-gluehome` as a global package.
```
npm i -g @gluehome/homebridge-gluehome
```

## Requirements

In order to use `@gluehome/homebridge-gluehome`, it is required to create an api key.

```
curl --location --request POST 'https://user-api.gluehome.com/v1/api-keys' \
--header 'Content-Type: application/json' \
-u username:password \
--data-raw '{
    "name": "My Test Key",
    "scopes": ["events.read", "locks.read", "locks.write"]
}'
```

## Configuration

Provide your api key in the `~/.homebridge/config.json` file.

```json
    "platforms": [
        {
            "platform": "GlueHomebridge",
            "name": "Glue Homebridge",
            "apiKey": "<you api key>"
        }
    ]
```
