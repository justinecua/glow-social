## Getting Started

Instructions on setting up your project locally. To get a local copy up and
running, follow these simple example steps.

### Prerequisites

This is a list of required software to run this locally.

- Create an Ubuntu 22.04 environment/Ubuntu 22.04 VM.
- Install Python 3.12
```sh
sudo apt update sudo apt install software-properties-common sudo
add-apt-repository ppa:deadsnakes/ppa sudo apt install python3.12 python3.12 --version
```

- Install Python 3.12 virtual environment
```sh
sudo apt-get install build-essential libssl-dev libffi-dev python3.12-dev sudo
apt-get install -y python3.12-venv
```
- Install mysqlclient
```sh
sudo apt install python3.12-dev build-essential sudo apt install libssl3 sudo
apt install libssl-dev sudo apt install libmysqlclient-dev
```
- Installation
- Create a folder on your desktop, name it anything you want, and open it in the
terminal.
- Create a virtual environment
```sh
python3.12 -m venv name_of_your_env
```
- Activate the environment
```sh
source name_of_your_env/bin/activate
```
- To deactivate the environment
```sh
deactivate
```
- Clone/Download this repository to the folder you just created
```sh
https://github.com/justinecua/social-media-django-backend.git
```
- Install packages using pip
```sh
pip install -r requirements.txt
```
- Apply database migrations
```sh
python manage.py makemigrations python manage.py migrate
```
- Create a superuser and fill in all the necessary fields
```sh
python manage.py createsuperuser
```
- Run the project
```sh
python manage.py runserver 0.0.0.0:8000
```
