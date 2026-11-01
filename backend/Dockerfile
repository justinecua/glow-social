FROM ubuntu:20.04
RUN apt-get update
RUN apt-get install -y software-properties-common
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get update
RUN apt-get install -y python3.12
RUN python3.12 --version
RUN apt-get install -y python3.12-dev build-essential
RUN apt-get install -y python3-dev default-libmysqlclient-dev build-essential
RUN apt-get install -y libssl1.1
RUN apt-get install -y libssl-dev
RUN apt-get install -y libmysqlclient-dev
RUN ln /usr/bin/python3.12 /usr/bin/python
RUN apt-get install -y python3-pip
RUN pip install --upgrade pip
RUN apt-get update && apt-get install -y postgresql-client
ENV PYTHONUNBUFFERED=1
WORKDIR /api
COPY requirements.txt /api/
RUN pip install -r requirements.txt
COPY . /api/
RUN apt-get install -y apt-utils vim curl
EXPOSE 8000

