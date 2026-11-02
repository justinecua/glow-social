from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id

from . import services
from .services import SparkError


def not_found():
    return Response({"detail": "Spark not found."}, status=status.HTTP_404_NOT_FOUND)


class Sparks(APIView):  # GET your Today timeline, POST shares a spark
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(services.today(current_account_id(request)))

    def post(self, request):
        try:
            spark_id = services.create(current_account_id(request), request.data)
        except SparkError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"id": spark_id}, status=status.HTTP_201_CREATED)


class SparkDetail(APIView):  # GET viewers and warms (author only), DELETE removes your spark
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, spark_id):
        spark = services.find_own_spark(spark_id, current_account_id(request))
        if not spark:
            return not_found()
        return Response(services.stats(spark))

    def delete(self, request, spark_id):
        spark = services.find_own_spark(spark_id, current_account_id(request))
        if not spark:
            return not_found()
        services.remove(spark)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ViewSpark(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, spark_id):
        me = current_account_id(request)
        spark = services.find_visible_spark(spark_id, me)
        if not spark:
            return not_found()
        services.mark_viewed(spark, me)
        return Response({"ok": True})


class WarmSpark(APIView):  # POST warms a spark, DELETE takes the warm back
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, spark_id):
        me = current_account_id(request)
        spark = services.find_visible_spark(spark_id, me)
        if not spark:
            return not_found()
        try:
            return Response({"warms": services.warm(spark, me)})
        except SparkError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, spark_id):
        me = current_account_id(request)
        spark = services.find_visible_spark(spark_id, me)
        if not spark:
            return not_found()
        return Response({"warms": services.unwarm(spark, me)})
