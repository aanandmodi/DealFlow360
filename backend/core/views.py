"""
Core views — JWT login/refresh, registration, user info.
"""
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .throttles import AuthenticationThrottle
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthenticationThrottle])
def register_view(request):
    """Register a new internal user."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'message': 'Account requested. A workspace administrator must activate your access before you can sign in.'}, status=201)



@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthenticationThrottle])
def login_view(request):
    """Login with username/password, returns JWT tokens."""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'tokens': {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return current user profile."""
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def users_list_view(request):
    """List all users (admin/manager only)."""
    from .models import User
    if request.user.role not in ('admin', 'sales_manager', 'finance'):
        return Response({'detail': 'Not authorized'}, status=403)
    users = User.objects.all()
    role = request.query_params.get('role')
    if role:
        users = users.filter(role=role)
    return Response(UserSerializer(users, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        token = RefreshToken(request.data.get('refresh', ''))
        if str(token['user_id']) == str(request.user.pk):
            token.blacklist()
    except Exception:
        pass
    return Response(status=204)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_view(request):
    from django.db import connection
    from django.core.cache import cache
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        cache.get('healthcheck')
    except Exception:
        return Response({'status': 'unavailable'}, status=503)
    return Response({'status': 'ok'})
