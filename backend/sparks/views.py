from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import account_id_for_user

from . import services
from .models import Spark
from .services import SparkError


def _me(request):
    return account_id_for_user(request.user)


def _visible(request, spark_id):
    spark = Spark.objects.filter(id=spark_id).first()
    if not spark or not services.can_see(spark, _me(request)):
        return None
    return spark


class Sparks(APIView):
    """GET: your Today timeline. POST: share a spark."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(services.today(_me(request)))

    def post(self, request):
        try:
            spark = services.create(_me(request), request.data, request=request)
        except SparkError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"id": spark.id}, status=status.HTTP_201_CREATED)


class SparkDetail(APIView):
    """GET: viewers & warms (author only). DELETE: remove your spark."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, spark_id):
        spark = Spark.objects.filter(id=spark_id, account_id=_me(request)).first()
        if not spark:
            return Response({"detail": "Spark not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(services.stats(spark))

    def delete(self, request, spark_id):
        spark = Spark.objects.filter(id=spark_id, account_id=_me(request)).first()
        if not spark:
            return Response({"detail": "Spark not found."}, status=status.HTTP_404_NOT_FOUND)
        services.remove(spark)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ViewSpark(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, spark_id):
        spark = _visible(request, spark_id)
        if not spark:
            return Response({"detail": "Spark not found."}, status=status.HTTP_404_NOT_FOUND)
        services.mark_viewed(spark, _me(request))
        return Response({"ok": True})


class WarmSpark(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, spark_id):
        spark = _visible(request, spark_id)
        if not spark:
            return Response({"detail": "Spark not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            return Response({"warms": services.warm(spark, _me(request))})
        except SparkError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
